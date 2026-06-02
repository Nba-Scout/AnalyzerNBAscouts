# NBA Scout — Arquitetura Profissional

Documento vivo de referência da transformação do NBA Scout de um MVP monolítico para uma arquitetura de produção. Cada passo é registrado aqui conforme avança.

---

## Índice

1. [Estado Anterior (MVP)](#estado-anterior-mvp)
2. [Arquitetura-Alvo](#arquitetura-alvo)
3. [Decisões de Design](#decisões-de-design)
4. [Estrutura do Monorepo](#estrutura-do-monorepo)
5. [Passo 1 — Fundação ✅](#passo-1--fundação-)
6. [Passo 2 — Async + Paralelização 🔄](#passo-2--async--paralelização-)
7. [Passo 3 — Redis Cache 📋](#passo-3--redis-cache-)
8. [Passo 4 — ARQ Worker + Inversão de Fluxo 📋](#passo-4--arq-worker--inversão-de-fluxo-)
9. [Passo 5 — Backfill do Data Warehouse 📋](#passo-5--backfill-do-data-warehouse-)
10. [Passo 6 — Frontend Vite/TS 📋](#passo-6--frontend-vitets-)
11. [Passo 7 — Deploy 📋](#passo-7--deploy-)
12. [Como rodar localmente](#como-rodar-localmente)

---

## Estado Anterior (MVP)

O projeto funcionava mas tinha problemas sérios de arquitetura:

| Problema | Impacto |
|---|---|
| Backend 100% **síncrono** (`requests`) | `GET /api/props` levava **40-120s** — análise rodava inline no request |
| Sem banco de dados | Persistência só em arquivos `.json` no `.cache/` |
| Frontend compilado **no browser** via Babel CDN | Sem build step, sem TypeScript, ~3000 linhas em globals `window.*` |
| Sem Docker, CI/CD, testes | Zero automação, roda só local |

---

## Arquitetura-Alvo

```
Browser (Vite/React) ──▶ nginx ──▶ /api ──▶ FastAPI (async, <50ms)
                                                 │
                                         ARQ Worker (background)
                                                 │
                                    asyncio.gather + httpx
                                                 │
                               ESPN APIs / The Odds API / nba_api
                                                 │
                                   PostgreSQL ◀──┘  Redis (cache + broker)
                                   (data warehouse)
```

**Princípio central — inversão do fluxo:** a análise pesada (40-120s) sai do request-path. Um worker ARQ a executa periodicamente em background e grava o resultado no Postgres. `GET /api/props` só lê esse resultado → resposta **< 50ms**.

**Data warehouse:** o Postgres guarda gamelogs históricos de **10 temporadas** (só jogadores ativos, ~350k linhas, ~100 MB). Stats de jogos finalizados são imutáveis → cache perfeito. Elimina dependência de HTTP em tempo real para histórico.

---

## Decisões de Design

| Decisão | Escolha | Justificativa |
|---|---|---|
| **Estrutura do repo** | Monorepo (`backend/` + `frontend/`) | 1 PR atômico por mudança de contrato; `docker compose up` sobe tudo |
| **Fila de tarefas** | ARQ | Async-native (combina com httpx/asyncio), broker = Redis (sem Celery Beat extra) |
| **Frontend** | Vite + TypeScript incremental | Build real; migração `.jsx`→`.tsx` arquivo-a-arquivo sem reescrever 3k linhas |
| **Deploy** | Decidir depois | Docker + CI + ghcr.io montados agora; servidor quando houver domínio |
| **Dados históricos** | Data warehouse Postgres (backfill Kaggle + incremental nba_api) | 10 temporadas, só ativos; elimina 40-120s do request e risco de geoblock |
| **Runtime de desenvolvimento** | WSL Ubuntu + Docker Engine direto | Sem Docker Desktop |
| **Custo** | **R$ 0** | Tudo open-source e local até o deploy |

---

## Estrutura do Monorepo

```
nba-scout/
├── backend/                    # FastAPI + SQLAlchemy async + ARQ
│   ├── pyproject.toml          # Deps via uv (substitui requirements.txt)
│   ├── Dockerfile
│   ├── alembic.ini + alembic/  # Migrations async
│   └── app/
│       ├── main.py             # FastAPI app + lifespan
│       ├── core/               # Settings (pydantic-settings), constants, teams, logging
│       ├── analytics/          # ev.py (lógica de EV — preservada verbatim), stats_parsing.py
│       ├── db/                 # SQLAlchemy models + session + Alembic env
│       │   └── models/         # Team, Player, Game, PlayerGameLog*, SyncState,
│       │                       # AnalysisSnapshot, AnalyzedProp, LineSnapshot, Bet
│       ├── schemas/            # Pydantic v2: PropOut, PlayerDetailOut, StatusOut, BetCreate/Out
│       ├── cache/              # Redis keys.py + repository.py (get/set JSON com TTL)
│       ├── routers/            # /health, /api/props, /api/player, /api/bets
│       └── workers/            # ARQ settings + tasks (run_daily_analysis, sync_player_logs)
│
├── frontend/                   # Vite + React 18 + TypeScript incremental
│   ├── index.html              # Sem CDNs; fontes Google via <link>
│   ├── vite.config.ts          # Proxy /api → localhost:8000 em dev
│   ├── tsconfig.app.json       # allowJs:true, checkJs:false (migração incremental)
│   └── src/
│       ├── main.tsx            # Entry point (stub → App.tsx + QueryClientProvider)
│       ├── styles/global.css   # CSS migrado do legado
│       ├── api/                # client.ts, queries.ts (TanStack Query — C1)
│       ├── types/api.ts        # Prop, PropsResponse, PlayerDetail, etc.
│       ├── lib/                # format.ts, teams.ts, props.ts, csv.ts
│       ├── hooks/              # useFavorites, useTweaks, useIsMobile
│       ├── components/         # atoms/, StarButton, tweaks/
│       └── pages/              # Dashboard/, Player/
│
├── docker/
│   ├── compose.yml             # Base (prod): api, worker, postgres, redis, frontend
│   └── compose.override.yml    # Dev: hot-reload, bind mounts, portas expostas
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml              # Lint + tests backend (matrix 3.11/3.12) + build frontend
│   │   └── build-push.yml      # Docker images → ghcr.io (SHA + semver + latest)
│   ├── dependabot.yml          # pip + npm + docker + actions (atualização semanal)
│   └── CODEOWNERS
│
├── docs/
│   ├── ARCHITECTURE.md         # Este arquivo
│   └── PLANO_ARQUITETURA_PROFISSIONAL.md  # Plano detalhado (exportável para Notion)
│
├── static/                     # Legado React/Babel — mantido até cutover (Passo 6)
├── api.py, scout.py, ev.py...  # Legado Python monolítico — mantido até Passo 4
│
├── Makefile                    # make dev | test | lint | migrate | build | logs
├── .pre-commit-config.yaml     # ruff + gitleaks + large-files
└── .env.example                # Template de variáveis de ambiente
```

> `*` **PlayerGameLog** é a tabela-fonte do data warehouse (1 linha por jogador × jogo).

---

## Passo 1 — Fundação ✅

**Data:** 2026-06-02 | **Branch:** `main`

### O que foi feito

- ✅ **`backend/pyproject.toml`** — gestão de deps via `uv`; FastAPI, SQLAlchemy 2.0 async, ARQ, httpx, structlog, ruff, mypy, pytest
- ✅ **`backend/app/core/`** — `Settings` (pydantic-settings, lê `.env`), `constants.py`, `teams.py` (30 times + helpers), `logging.py` (structlog JSON em prod)
- ✅ **`backend/app/analytics/ev.py`** — lógica de EV preservada verbatim; independente de deps externas (testável sem banco/redis)
- ✅ **`backend/app/analytics/stats_parsing.py`** — `games_over_line` e `get_last5_values` extraídos do legado
- ✅ **`backend/app/db/models/`** — 9 modelos SQLAlchemy 2.0 async (data warehouse + estado da aplicação)
- ✅ **`backend/alembic/`** — migrations async configuradas
- ✅ **`backend/app/main.py`** + routers, schemas, cache, workers — stubs com contratos definidos
- ✅ **`backend/tests/unit/test_ev.py`** — **33 testes, 33/33 passando** (Normal CDF, cascata de minutos, clamps, EV, Kelly, classify)
- ✅ **`docker/compose.yml`** + `compose.override.yml` — stack completa (dev + prod-like)
- ✅ **`frontend/`** — Vite react-ts scaffolded, build **✓ 172ms**, proxy `/api`, `allowJs:true`, CSS migrado
- ✅ **`.github/workflows/`** — CI (ruff + mypy + pytest com Postgres/Redis como services + build frontend) + build-push (ghcr.io)
- ✅ **Tooling** — dependabot, CODEOWNERS, pre-commit (ruff + gitleaks), Makefile, .env.example

### Verificação

```bash
# Testes do backend
cd backend && python -m pytest tests/unit/test_ev.py -v
# Resultado: 33 passed in 0.14s ✅

# Build do frontend
cd frontend && npm run build
# Resultado: ✓ built in 172ms ✅
```

---

## Passo 2 — Async + Paralelização 🔄

**Status:** Pendente | **Modelo recomendado:** Claude Opus (lógica crítica)

### O que será feito

- Migrar `requests` → `httpx.AsyncClient` (cliente de processo-longo no lifespan)
- Reescrever `analyze_day()` async em 3 fases com `asyncio.gather` + semáforos:
  - **Fase A:** por jogo — props + rosters + lesões + defesa em paralelo
  - **Fase B:** dedup player_ids → busca stats 1× cada (Semaphore(8-10))
  - **Fase C:** EV é CPU-puro → loop síncrono (lógica `ev.py` intacta)
- `nba_api` (síncrono) via `run_in_executor`
- Semáforo dedicado para Odds API (Semaphore(3)) + checagem de quota no Redis
- Resultado esperado: **40-120s → < 10s**

**Arquivos:** `backend/app/clients/espn.py`, `clients/odds.py`, `services/analysis.py`

---

## Passo 3 — Redis Cache 📋

**Status:** Pendente

Substitui os arquivos `.cache/*.json` por chaves Redis com TTL nativo:

| Chave | TTL | Substitui |
|---|---|---|
| `v1:espn:player_index` | 24h | `player_index.json` |
| `v1:espn:injuries:{abbr}` | 1h | `injuries_{time}.json` |
| `v1:espn:po_hist:{id}:{year}` | 7d | `po_hist_*.json` |
| `v1:espn:matchup:{team_id}` | 6h | cache em memória |
| `v1:odds:quota:remaining` | — | chamadas redundantes |

**Arquivo:** `backend/app/cache/keys.py` (já criado), `cache/repository.py` (já criado)

---

## Passo 4 — ARQ Worker + Inversão de Fluxo 📋

**Status:** Pendente

- Task `run_daily_analysis(ctx)` chama `services.analysis.analyze_day()` async e grava em `AnalysisSnapshot` + `AnalyzedProp`
- Cron: `cron(run_daily_analysis, minute={0, 30})` (calibrar conforme quota)
- Endpoints reescritos:
  - `GET /api/props` → **só lê** o último snapshot (< 50ms)
  - `POST /api/refresh` → enfileira job (throttle no Redis)
  - `GET /api/status` → estado do worker, quota, próximo refresh

**Arquivos:** `backend/app/workers/tasks.py`, `routers/props.py`

---

## Passo 5 — Backfill do Data Warehouse 📋

**Status:** Pendente

- Criar `backend/app/services/ingest.py`
- Importar dataset Kaggle (NBA box scores, histórico completo) → filtrar pelos jogadores ativos via roster nba_api → popular `player_game_logs` com as últimas 10 temporadas
- Implementar `sync_player_logs(ctx, player_id)` para incremental diário
- Lazy-refresh: se `sync_state.last_game_date` for "velho" ao consultar `/api/player/{name}`, enfileirar `sync_player_logs`

---

## Passo 6 — Frontend Vite/TS 📋

**Status:** Pendente (C1 → C4)

- **C1:** `data.jsx` → `lib/teams.ts` + `types/api.ts` + `api/client.ts` + `api/queries.ts` (TanStack Query v5 com `refetchInterval: 5min`)
- **C2:** `favorites.jsx` → `hooks/useFavorites.ts`; `tweaks-panel.jsx` → `hooks/useTweaks.ts`
- **C3:** Extrair funções puras de `dashboard.jsx` (1358 linhas) → `lib/props.ts` + `lib/csv.ts`; páginas `Dashboard/` e `Player/`
- **C4:** ESLint + Prettier + Vitest; converter `.jsx` → `.tsx` arquivo-a-arquivo
- **Cutover:** remover `app.mount("/", StaticFiles...)` do `api.py` legado + pasta `static/` (commit isolado e reversível)

---

## Passo 7 — Deploy 📋

**Status:** Pendente (aguardando decisão de plataforma)

Template do workflow `deploy.yml` já existe em `.github/workflows/build-push.yml`. Quando a plataforma for decidida:

- **VPS (recomendado):** Hetzner/DigitalOcean ~€5/mês, TLS automático via Traefik + Let's Encrypt, deploy por SSH
- **PaaS:** Render, Fly.io ou Railway — zero gestão de servidor, mais caro em escala
- Incluirá: `alembic upgrade head` no deploy, Sentry, Prometheus + Grafana

---

## Como rodar localmente

### Pré-requisitos
- Docker Engine (WSL Ubuntu) + `docker compose`
- `uv` instalado (`pip install uv`)
- Node 24 + npm

### Stack completa (dev)
```bash
# Clone e configure
git clone https://github.com/seu-usuario/nba-scout
cd nba-scout
cp .env.example .env
# Editar .env: ODDS_API_KEY=...

# Subir Postgres + Redis + API + Worker
make dev

# Em outro terminal — frontend com HMR
make dev-frontend
# Acesse: http://localhost:5173
```

### Só testes
```bash
make test
# ou: cd backend && python -m pytest tests/ -v
```

### Migrations
```bash
# Após subir o Postgres
make migrate
# Para criar uma nova migration:
make makemigration msg="add_player_positions"
```

### Build de imagens
```bash
make build
# ou: docker compose -f docker/compose.yml build
```

---

## Legado (estável, não tocar até Passo 4/6)

O monólito original (`api.py`, `scout.py`, `ev.py`, `stats.py`, `odds.py`, `static/`) continua **100% funcional** em paralelo. Para rodar o legado:

```bash
python api.py
# Acesse: http://localhost:8000
```

O cutover (remover o legado) só acontece nos Passos 4 e 6, depois de validar paridade completa.
