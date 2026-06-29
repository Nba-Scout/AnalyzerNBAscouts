# ADR 0002 — Plataforma de deploy: VPS + Docker Compose via SSH

- **Status:** aceito
- **Data:** 2026-06-28
- **Decisão tomada no:** Passo 7 (Deploy/CI-CD).

## Contexto

O Passo 7 precisa de um alvo de deploy concreto para o `deploy.yml`. A stack já é
um **`docker compose`** completo (`frontend` nginx + `api` + `worker` + `postgres` +
`redis`), com imagens publicadas no **ghcr.io** pelo `build-push.yml`. O projeto é de
time pequeno, tráfego modesto e orçamento enxuto. Restrições relevantes:

- `nba_api`/`stats.nba.com` sofre **geoblock** em vários IPs de cloud → às vezes é
  preciso sair por um **proxy** (controle de rede do host ajuda).
- Quota da Odds API é pequena (500 req/mês) → não há necessidade de auto-scaling.

## Decisão

Deploy em **VPS único** (ex.: Hetzner/DigitalOcean) rodando **Docker Compose**,
acionado por **SSH** a partir do GitHub Actions (`deploy.yml`):

1. CI/build publica imagens no ghcr.io.
2. `deploy.yml` faz SSH no host → `docker compose -f compose.yml -f compose.prod.yml pull`
   → `alembic upgrade head` → `up -d --wait` → healthcheck `/health/ready`.
3. `staging` no push de `main`; `production` em tag `v*` (com required reviewers).

## Alternativas consideradas

| Opção | Por que não (agora) |
|---|---|
| **PaaS (Railway/Render/Fly.io)** | Mais simples de operar, mas custo/lock-in maiores e menos controle de rede (proxy p/ geoblock do nba_api é mais difícil). Reavaliar se ops virar gargalo. |
| **Kubernetes** | Robustez/escala que não precisamos neste estágio; complexidade operacional alta (manifests/Helm, ingress, secrets) para 1 serviço + worker. |

## Consequências

- ➕ Custo baixo, controle total de rede (proxy, firewall), 1:1 com o compose de dev.
- ➕ Rollback simples: re-deploy de uma tag de imagem anterior (`workflow_dispatch`).
- ➖ Ponto único de falha; HA e escala horizontal não são triviais.
- ➖ Manutenção do host (patches, backup) é responsabilidade nossa → ver
  [RUNBOOK.md](../RUNBOOK.md) e `scripts/backup-postgres.sh`.
- 🔁 **Gatilho de reavaliação:** se precisar de HA/multi-região ou o ops do host pesar,
  migrar para PaaS (menor salto) ou k8s.
