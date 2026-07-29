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

## Atualização 2026-07-24 (tarefa B1) — provedor escolhido

A decisão de plataforma (VPS + Compose via SSH) segue valendo; faltava o **provedor**.
Escolhido o **Oracle Cloud Infrastructure — Always Free**, shape `VM.Standard.A1.Flex`
(ARM Ampere A1, até 2 OCPU / 12 GB desde o corte de jun/2026), Ubuntu 24.04.

Motivo: a plataforma ainda está em fase de teste e o orçamento agora é **zero**. Entre as
opções sem custo permanente, a A1 é a única que entrega recursos folgados (12 GB contra
1 GB do e2-micro do GCP) mantendo o modelo do ADR — VPS de verdade, com controle de rede
para o proxy do geoblock.

**Consequência técnica:** o host é ARM, então `build-push.yml` **e** `ci.yml` passaram a
construir **multi-arch** (`linux/amd64,linux/arm64`) via QEMU. Sem isso, o
`docker compose pull` no host falha com *no matching manifest for linux/arm64*. Custo real:
todo build (inclusive em PR) fica mais lento, porque a variante arm64 é emulada; o cache do
GHA reduz o reincidente, mas a primeira build de cada mudança de dependência paga o preço
integral. Aceitamos o custo para não descobrir quebra de build no mesmo evento que faz o
deploy. Se incomodar, a saída é runner ARM nativo em vez de emulação.

**Riscos aceitos:** capacidade de A1 varia por região ("out of host capacity"); a Oracle
pode reclamar instâncias ociosas (mitigado pelos crons diários); e há **dois** níveis de
firewall (ufw + Security List da VCN) mais regras legadas de iptables na imagem — ver
[DEPLOY.md § 1.1](../DEPLOY.md).

**Gatilho de reavaliação:** se a A1 ficar indisponível na região ou o free tier mudar de
novo, o caminho mais curto é uma VPS paga barata (ex.: Hetzner CX22) — o provisionamento é
o mesmo `scripts/provision-vps.sh` e as imagens amd64 continuam publicadas.

## Consequências

- ➕ Custo baixo (hoje **zero**), controle total de rede (proxy, firewall), 1:1 com o compose de dev.
- ➕ Rollback simples: re-deploy de uma tag de imagem anterior (`workflow_dispatch`).
- ➖ Ponto único de falha; HA e escala horizontal não são triviais.
- ➖ Manutenção do host (patches, backup) é responsabilidade nossa → ver
  [RUNBOOK.md](../RUNBOOK.md) e `scripts/backup-postgres.sh`.
- 🔁 **Gatilho de reavaliação:** se precisar de HA/multi-região ou o ops do host pesar,
  migrar para PaaS (menor salto) ou k8s.
