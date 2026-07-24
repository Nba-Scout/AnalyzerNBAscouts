# Imagens de container (production-grade)

Estratégia das imagens Docker do NBA Scout. Build/push automatizado por
[`.github/workflows/build-push.yml`](../.github/workflows/build-push.yml) →
`ghcr.io/<owner>/nba-scout-{backend,frontend}`.

## Arquiteturas publicadas: `linux/amd64` + `linux/arm64`

Ambas as imagens saem **multi-arch**. O motivo é o host de deploy: a instância Always Free
da Oracle é **ARM** (Ampere A1) — ver [ADR 0002](./adr/0002-deploy-platform.md) § Atualização
2026-07-24. Sem a variante `arm64`, o `docker compose pull` no host morre com
*no matching manifest for linux/arm64/v8*. `amd64` continua publicado para dev local e
para qualquer host x86.

A variante arm64 é construída **emulada** por QEMU (`docker/setup-qemu-action`) num runner
amd64, então o `build-push.yml` ficou mais lento. Medido localmente (cache frio, Docker
com binfmt): o estágio de build arm64 do frontend levou **~85 s** (o `vite build` em si,
~11 s) e o backend passou sem compilar nada. É custo aceitável, não ordem de grandeza.
O cache do GHA tem `scope` por serviço para que backend e frontend não briguem pela mesma
entrada.

Verificar o manifest publicado:

```bash
docker buildx imagetools inspect ghcr.io/nba-scout/nba-scout-backend:latest
# deve listar linux/amd64 e linux/arm64
```

Nenhum dos Dockerfiles precisou mudar: as bases (`python:3.11-slim`, `node:26-alpine`,
`nginx:1.31-alpine`) já têm variante arm64, e todas as deps Python do projeto (incl.
`lxml`, `pandas`, `asyncpg`) publicam wheels `manylinux aarch64` — nada compila da fonte,
o que importa porque a imagem slim não tem compilador.

## Backend — [`backend/Dockerfile`](../backend/Dockerfile)

Multi-stage `base → deps → runtime`:

- **`base`** — `python:3.11-slim` + `uv`, com `PYTHONPATH=/app`.
- **`deps`** — instala **somente dependências de produção** (`uv pip install -e .`,
  **sem** `[dev]`). Pytest/ruff/mypy/etc. ficam fora do runtime → imagem menor e
  menor superfície de ataque.
- **`runtime`** — `python:3.11-slim`, usuário **não-root** (`appuser`, uid 1000),
  copia só as deps de produção do stage `deps`, `HEALTHCHECK` em `/health`,
  OCI labels para rastreabilidade.

A suíte de testes **não** roda num estágio Docker: o CI (job `backend` de
[`ci.yml`](../.github/workflows/ci.yml)) já roda `pytest` com Postgres/Redis como
`services`. Por isso não há `[dev]` em lugar nenhum da imagem.

### Workers configuráveis
Gunicorn lê o nº de workers da env **`WEB_CONCURRENCY`** (default `2` na imagem)
quando `--workers` não é passado. Ajuste por ambiente sem rebuild:
`WEB_CONCURRENCY=4 docker compose up -d api`.

### Migrations dentro da imagem
`backend/.dockerignore` **não** ignora `alembic/versions/*.py` — as migrations
precisam estar na imagem para o passo de deploy rodar:

```bash
docker compose run --rm api alembic upgrade head
```

(Ver [`DEPLOY.md`](./DEPLOY.md).)

## api e worker = MESMA imagem, `command` diferente

Em [`docker/compose.yml`](../docker/compose.yml) os serviços `api` e `worker`
fazem build do **mesmo** `backend/Dockerfile`. A única diferença:

| Serviço | Command |
|---|---|
| `api` | `gunicorn app.main:app -k uvicorn.workers.UvicornWorker …` (CMD default) |
| `worker` | `arq app.workers.settings.WorkerSettings` |

Isso evita uma segunda imagem e garante paridade de dependências entre web e worker.

## Cron roda DENTRO do worker — sem serviço `scheduler`

O agendamento é feito pelo próprio ARQ via `cron_jobs` em
[`app/workers/settings.py`](../backend/app/workers/settings.py):

```python
cron_jobs = [cron(run_daily_analysis, hour=_cfg.cron_analysis_hour, minute=0)]
```

Ou seja: o worker ARQ já é o scheduler. **Não** é necessário um container
`scheduler`/`cron`/`celery-beat` separado. Para mudar a frequência, ajuste
`CRON_ANALYSIS_HOUR` (env) ou os `cron_jobs`.

## Frontend — [`frontend/Dockerfile`](../frontend/Dockerfile)

Multi-stage `node:26-alpine` (build Vite) → `nginx:1.31-alpine` (serve).
A SPA é estática; o nginx faz proxy de `/api` → `api:8000` e aplica
**security headers** (CSP básica, `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`) em [`frontend/nginx.conf`](../frontend/nginx.conf).

> Se o redesign do frontend passar a carregar origens externas (Google Fonts, CDN,
> analytics), a **CSP** em `nginx.conf` precisa ser estendida (`script-src`/
> `font-src`/`connect-src`), senão o navegador bloqueia o recurso.
