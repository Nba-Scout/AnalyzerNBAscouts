# DEPLOY — NBA Scout

Guia de deploy de cabo a rabo. Plataforma: **VPS + Docker Compose via SSH**
(ver [ADR 0002](./adr/0002-deploy-platform.md)). CD por
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).

## Visão geral

```
push main ─▶ build-push.yml ─▶ ghcr.io (imagens) ─▶ deploy.yml (staging)
tag v* ────▶ build-push.yml ─▶ ghcr.io ──────────▶ deploy.yml (production, c/ reviewers)
                                                         │ SSH
                                                         ▼
                              VPS: docker compose pull → alembic upgrade head → up -d → /health/ready
```

Imagens (ver [IMAGES.md](./IMAGES.md)): `ghcr.io/nba-scout/nba-scout-backend` e
`-frontend`. `api` e `worker` usam a **mesma** imagem backend (só muda o `command`);
o **cron roda dentro do worker** (sem scheduler separado).

---

## 1. Pré-requisitos do host (VPS)

- Linux com **Docker** + **Docker Compose v2** (`docker compose version`).
- Usuário com acesso ao Docker e uma **chave SSH** dedicada ao deploy.
- **Checkout do repo** em `DEPLOY_PATH` (default `/opt/nba-scout`):
  ```bash
  sudo mkdir -p /opt/nba-scout && sudo chown "$USER" /opt/nba-scout
  git clone https://github.com/Nba-Scout/AnalyzerNBAscouts.git /opt/nba-scout
  cd /opt/nba-scout
  ```
- Arquivo **`.env`** na raiz (a partir de [`.env.example`](../.env.example)):
  ```bash
  cp .env.example .env && nano .env
  ```
  Preencha no mínimo: `ODDS_API_KEY`, `POSTGRES_PASSWORD`, `ENVIRONMENT=production`,
  `SENTRY_DSN` (opcional). `POSTGRES_HOST=postgres` e `REDIS_URL=redis://redis:6379/0`
  já são injetados pelo compose.

---

## 2. Primeiro provisionamento (manual, 1×)

No host, com `.env` pronto:

```bash
cd /opt/nba-scout
export IMAGE_TAG=latest
COMPOSE="docker compose -f docker/compose.yml -f docker/compose.prod.yml"

# (imagens privadas) login no ghcr
echo "$GHCR_TOKEN" | docker login ghcr.io -u <user> --password-stdin

$COMPOSE pull
$COMPOSE up -d --no-build --wait postgres redis
$COMPOSE run --rm api alembic upgrade head     # cria o schema
$COMPOSE up -d --no-build --wait                # api, worker, frontend
curl -fsS http://localhost:8000/health/ready    # deve responder ok
```

Atalho equivalente: **`make deploy`** (ver [Makefile](../Makefile)).

Frontend fica em `:8080`, API em `:8000`. Em produção real, coloque um reverse
proxy/TLS (nginx/Caddy/Traefik) na frente — fora do escopo deste compose.

### Seed do data warehouse (1×)
Com o worker no ar, popule o histórico de gamelogs (via ESPN, sem geoblock):

```bash
make backfill            # = enqueue backfill_all_active (2 temporadas) p/ todos os ativos
$COMPOSE logs -f worker  # acompanha o processamento em background
```

Depois disso o **sync incremental roda sozinho por cron** (`CRON_WAREHOUSE_SYNC_HOUR`,
default 13h UTC, antes da análise) e mantém só os últimos `WAREHOUSE_MAX_GAMES_PER_PLAYER`
(100) jogos por jogador. Ver [RUNBOOK.md](./RUNBOOK.md) § Data warehouse.

---

## 3. Setup no GitHub (1×)

### Environments (Settings › Environments)
Crie **`staging`** e **`production`**. Em `production`, marque
**Required reviewers** (deploy de prod só roda após aprovação).

### Secrets (por environment)
| Secret | Descrição |
|---|---|
| `SSH_HOST` | host/IP do VPS |
| `SSH_USER` | usuário SSH |
| `SSH_KEY` | chave **privada** SSH (PEM) |
| `SSH_PORT` | (opcional) porta SSH; default 22 |
| `GHCR_TOKEN` | (opcional) PAT `read:packages` p/ login no ghcr no host (imagens privadas) |

### Variables (por environment)
| Variable | Default | Descrição |
|---|---|---|
| `DEPLOY_PATH` | `/opt/nba-scout` | caminho do checkout no host |

### Secrets da aplicação
Ficam no **`.env` do host**, não no GitHub: `ODDS_API_KEY`, `POSTGRES_*`,
`REDIS_URL`, `SENTRY_DSN`.

### Branch protection
Configure conforme [SECURITY.md](./SECURITY.md) (PR obrigatório, checks required,
sem force-push).

---

## 4. Fluxos de deploy

| Quero… | Ação |
|---|---|
| Deploy em **staging** | Mergear em `main` (build-push + deploy automáticos, tag `latest`). |
| Deploy em **production** | Criar tag `vX.Y.Z` e dar push (`git tag v1.2.3 && git push origin v1.2.3`). Requer aprovação do environment. |
| **Ensaiar** (sem aplicar) | Actions › Deploy › Run workflow → `dry_run=true` (default). Imprime o plano. |
| Deploy manual / **rollback** | Actions › Deploy › Run workflow → `environment`, `image_tag=<sha-xxxx \| 1.2.3 \| latest>`, `dry_run=false`. |

`IMAGE_TAG`: push em main → `latest`; tag `v1.2.3` → `1.2.3`; dispatch → o que você
informar (use uma tag antiga para rollback).

---

## 5. Rollback

1. Descubra a última tag boa no ghcr (`sha-<commit>` ou semver anterior — veja em
   *Packages* do repo, ou nos logs do build-push).
2. **Actions › Deploy › Run workflow** → `environment=production`,
   `image_tag=<tag-anterior>`, `dry_run=false`.
3. Isso re-puxa a imagem antiga e sobe. O healthcheck final valida.

> ⚠️ **Migrations não revertem sozinhas.** Se a migration nova for incompatível com a
> imagem antiga, rode o downgrade manual no host (ver [RUNBOOK.md](./RUNBOOK.md) §
> "Reverter migration"). Por isso, prefira migrations aditivas/retrocompatíveis.

---

## 6. Backup

`scripts/backup-postgres.sh` faz `pg_dump` (gzip, com retenção). Agendar no host:

```bash
# crontab -e  (diário 04:00)
0 4 * * * cd /opt/nba-scout && bash scripts/backup-postgres.sh >> /var/log/nba-scout-backup.log 2>&1
```

Restore: ver [RUNBOOK.md](./RUNBOOK.md).

---

## 7. Observabilidade (opcional)

Para subir Prometheus + Grafana junto (ver [Passo 7.4](../monitoring/)):

```bash
docker compose -f docker/compose.yml -f docker/compose.prod.yml \
  -f docker/compose.observability.yml up -d
# Grafana :3001 · Prometheus :9090
```

Sentry: defina `SENTRY_DSN` no `.env` (captura erros da API **e** do worker).
