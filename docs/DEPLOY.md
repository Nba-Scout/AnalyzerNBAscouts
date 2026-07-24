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

## 1. Provisionamento do host (VPS)

Alvo: **Ubuntu 24.04**. O host precisa de Docker + Compose v2, um usuário de deploy que
entre só por chave SSH, firewall fechado e o checkout do repo em `DEPLOY_PATH`.

### 1.1 Onde roda hoje: Oracle Cloud free tier (ARM)

Escolhido por ser **custo zero permanente** com folga de recursos (ver
[ADR 0002](./adr/0002-deploy-platform.md) § Atualização 2026-07-24):

| Item | Valor |
|---|---|
| Shape | `VM.Standard.A1.Flex` (**Always Free**) |
| CPU/RAM | até **2 OCPU / 12 GB** (limite reduzido pela Oracle em jun/2026; era 4/24) |
| Arquitetura | **ARM (aarch64)** → exige imagem multi-arch, publicada pelo `build-push.yml` |
| SO | Ubuntu 24.04 |
| Egress | 10 TB/mês |

Três armadilhas específicas da Oracle — as duas primeiras derrubam o deploy silenciosamente:

1. **Dois firewalls, não um.** Além do `ufw` no host, a **VCN** tem Security List / NSG
   próprios. Libere ingress **80** e **443** em *Networking › VCN › Security Lists*, senão
   o host fica inalcançável mesmo com o `ufw` liberado.
2. **Regras legadas de iptables na imagem.** A imagem Ubuntu da Oracle vem com
   `/etc/iptables/rules.v4` **rejeitando tudo menos a 22**. Elas convivem com o `ufw` e
   continuam bloqueando 80/443. O `verify-host.sh` detecta e o
   `provision-vps.sh --oci-iptables-fix` neutraliza (com backup do original).
3. **"Out of host capacity".** Capacidade de A1 varia por região, e o *home region* é
   definido no cadastro e não muda depois. Se der erro de capacidade, tente outro
   Availability Domain ou repita mais tarde.

> A conta pede **cartão para verificação de identidade**; recursos Always Free não geram
> cobrança. Instâncias ociosas podem ser reclamadas — no nosso caso os crons diários do
> worker já mantêm atividade suficiente.

### 1.2 Provisionamento automático (recomendado)

[`scripts/provision-vps.sh`](../scripts/provision-vps.sh) faz tudo o que a seção 1.4
descreve, de forma **idempotente**. No host, como usuário com sudo (na Oracle, `ubuntu`):

```bash
git clone https://github.com/Nba-Scout/AnalyzerNBAscouts.git /tmp/nba-prov
sudo bash /tmp/nba-prov/scripts/provision-vps.sh --dry-run   # ensaia, não altera nada
sudo bash /tmp/nba-prov/scripts/provision-vps.sh             # aplica
sudo bash /tmp/nba-prov/scripts/provision-vps.sh --oci-iptables-fix   # host Oracle
```

Instala pacotes base + Docker (repo oficial), cria o usuário `deploy` (sem senha, só
chave, no grupo `docker`), endurece o `sshd`, sobe o `ufw` (22/80/443), configura
`fail2ban` e `unattended-upgrades`, clona o repo em `/opt/nba-scout` e gera o `.env` com
`POSTGRES_PASSWORD` aleatória. `--help` lista todas as opções.

Detalhes que importam:

- **Chave SSH:** sem `--ssh-key`, reaproveita o `authorized_keys` de quem chamou o `sudo`
  (na Oracle, a chave que você subiu ao criar a instância). Para uma chave dedicada ao CD,
  gere no seu micro (`ssh-keygen -t ed25519 -f ~/.ssh/nba_deploy -N ""`) e passe
  `--ssh-key ~/.ssh/nba_deploy.pub`; a **privada** vai no secret `SSH_KEY`.
- **Anti-lockout:** o script **se recusa** a desabilitar a senha do SSH se não houver chave
  pública instalada, e valida com `sshd -t` antes de recarregar o serviço.
- **`.env` nunca é sobrescrito.** Se já existir, é preservado — a senha ali é a que o
  volume `pgdata` já usa, e trocar quebraria o acesso ao banco.
- **`ODDS_API_KEY` fica em branco** e precisa ser preenchida à mão antes do 1º deploy.
- O grupo `docker` é **equivalente a root** no host: o usuário `deploy` é poderoso por
  natureza. Administração do host continua pelo usuário default da imagem (`ubuntu`).

### 1.3 Verificação

[`scripts/verify-host.sh`](../scripts/verify-host.sh) é **somente leitura** e imprime o
checklist de saída (código 1 se algo obrigatório falhar):

```bash
sudo bash /opt/nba-scout/scripts/verify-host.sh
```

Cobre SO/arquitetura/RAM/disco/timezone, Docker + Compose, usuário no grupo `docker`,
`authorized_keys` e permissões, `PasswordAuthentication no`, `ufw` ativo com 22/80/443,
regras legadas de iptables, `fail2ban` + jail `sshd`, `unattended-upgrades`, checkout do
repo, e o `.env` (permissão 600, `ENVIRONMENT=production`, `ODDS_API_KEY`,
`POSTGRES_PASSWORD`, ausência de CRLF). Cole a saída na issue como evidência.

### 1.4 Equivalente manual (referência)

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

> **TLS/domínio ficam para o B2.** Este compose expõe o frontend em `:8080` e a API em
> `:8000`, **sem HTTPS** — o acesso até lá é por `http://<ip>:8080`. Não exponha a usuário
> final sem reverse proxy + certificado.

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

### Ensaio: dry-run do deploy

Com os secrets cadastrados, valide **sem aplicar nada**:
*Actions › Deploy › Run workflow* → `environment=staging`, `dry_run=true`.

O `deploy.yml` distingue dois cenários — não confunda um com o outro:

| Situação | O que aparece |
|---|---|
| `SSH_HOST` **ausente** | job verde com o `::notice::` "SSH_HOST não configurado — deploy real pulado (no-op verde)" |
| `SSH_HOST` **presente** + `dry_run=true` | job verde imprimindo o **plano** de deploy |

Só o segundo caso comprova que os secrets chegaram ao Environment. Um verde do primeiro
tipo é o pipeline dizendo "não fiz nada".

### Checklist de saída do B1

- [ ] Instância Always Free A1 (Ubuntu 24.04) criada e acessível por SSH
- [ ] Ingress 80/443 liberado na Security List da VCN
- [ ] `provision-vps.sh` aplicado (com `--oci-iptables-fix` no host Oracle)
- [ ] `ODDS_API_KEY` preenchida no `.env` do host
- [ ] `verify-host.sh` sem nenhum `[FAIL]`
- [ ] Login por chave funciona; senha **rejeitada** (`ssh -o PubkeyAuthentication=no deploy@<ip>` deve falhar)
- [ ] Environments `staging` e `production` criados, com required reviewers em `production`
- [ ] `deploy.yml` com `dry_run=true` verde **imprimindo o plano**

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
