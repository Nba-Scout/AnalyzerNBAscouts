# NBA Scout — Contexto Completo do Projeto

> **Para quem está lendo:** este arquivo existe para que uma IA externa (ou um colaborador novo) possa entender o estado completo do projeto de uma vez só, sem precisar ler dezenas de arquivos. Contém arquitetura, decisões, estado atual, próximos passos e armadilhas conhecidas.

---

## O que é o projeto

**NBA Scout** é uma ferramenta que identifica apostas com **valor esperado positivo (EV+)** em player props da NBA.

Cruza estatísticas reais dos jogadores (ESPN API pública, sem geoblock) com odds ao vivo de casas como Bet365 e Pinnacle (via The Odds API v4) para calcular probabilidade real, EV%, Kelly fracionado e classificar cada prop.

**Usuário-alvo:** apostador técnico brasileiro que quer vantagem matemática sobre as casas.

**Stack de dados:**
- ESPN API não-oficial (sem auth, sem geoblock — funciona do Brasil)
- The Odds API v4 (paga, free tier 500 req/mês)
- nba_api (biblioteca Python para `data.nba.com`)
- PostgreSQL + Redis (armazenamento e cache)

---

## Estado atual (2026-06-13)

### O que existe e funciona

**Legado (raiz do repo — mantido até cutover):**
- `api.py` — servidor síncrono Flask/FastAPI, serve `static/` como frontend
- `scout.py` — `analyze_day()` síncrono, faz análise no request-path (40–120s)
- `ev.py` — lógica de EV original, **100% funcional e testada** (33 testes passando)
- `static/` — frontend React/Babel compilado no browser (7 arquivos JSX ~3000 linhas)
- `requirements.txt` — deps legacy

**Nova arquitetura (Passos 1–5 + Saneamento + Passo 6 C1/C2 mergeados em `develop`; C3 em PR #41):**
- `backend/` — FastAPI async + SQLAlchemy 2.0 + ARQ + Redis; **101 testes**
- `frontend/` — Vite react-ts + React 19 + TS 6; Dashboard (3 variações) + Player completos, HashRouter, **33 testes Vitest**, Dockerfile/nginx
- `docker/` — Docker Compose stack completa
- `.github/workflows/` — CI completo (lint+type+test+build backend e frontend)

### Status dos Passos

| Passo | Branch mergeado em | Status | O que foi feito |
|---|---|---|---|
| 1 — Fundação | `main` | ✅ **Concluído** | pyproject.toml (uv), 9 modelos SQLAlchemy, Alembic async, CI/CD, Docker, 33 testes ev.py, scaffold frontend Vite |
| 2 — Async | `develop` | ✅ **Concluído** | httpx AsyncClient, analyze_day() 3 fases asyncio.gather, clients ESPN/Odds/nba_live, analytics, 94 testes |
| 3 — Infra | `develop` | ✅ **Concluído** | Lifespan completo, ARQ pool singleton, endpoints reais (cache-aside + throttle), worker cron, migration pg_trgm, Docker E2E |
| 4 — Paridade API | `develop` | ✅ **Concluído** | GET /api/player híbrido (DW→ESPN), line movement durável (LineSnapshot), quota real, 105 testes |
| 5 — Data Warehouse | `develop` | ✅ **Concluído** | services/ingest.py source-agnostic, adapters ESPN+Kaggle, tasks ARQ backfill, lazy-refresh stale |
| Saneamento | `develop` (PR #33) | ✅ **Concluído** | R1: configure_from_settings() no lifespan; R2: sync_player_logs removido; R3: lazy_refresh_stale_hours wired |
| 6 C1 — Fundação Frontend | `develop` (PR #34) | ✅ **Concluído** | types/api.ts (28 campos), api/queries.ts (TanStack Query v5), lib/*, atoms/*, hooks/*, 25 testes Vitest |
| 6 C2 — Dashboard | `develop` (PR #40) | ✅ **Concluído** | dashboard.jsx (1359 linhas) → src/pages/Dashboard/ (3 variações Terminal/Cards/Editorial), FilterBar, SummaryStrip, AccordionPanel, RefreshCountdown (via useRefresh), painel de tweaks, StarButton |
| 6 C3 — Player + Docker | PR #41 (→ develop) | 🔄 **CI rodando** | player.jsx (734 linhas) → src/pages/Player/, App.tsx HashRouter (Outlet context p/ tweaks), Dockerfile multi-stage + nginx.conf. 33 testes |
| Cutover | — | 📋 Pendente | Remover StaticFiles mount + static/ + legado da raiz após validar paridade |
| 7 — Deploy | — | 📋 Pendente | Aguardando escolha de plataforma (VPS ou PaaS) |

---

## Arquitetura-alvo

```
Browser (Vite/React) ──▶ nginx ──▶ /api ──▶ FastAPI (async, < 50ms)
                                                │
                                        POST /api/refresh
                                                │
                                         ARQ Worker (background)
                                                │
                                    asyncio.gather + httpx
                                                │
                               ESPN APIs / The Odds API / nba_api
                                                │
                                   PostgreSQL ◀──┘  Redis (cache + broker)
```

**Princípio central — inversão do fluxo:** a análise pesada (40–120s) sai do request-path. O worker ARQ executa `analyze_day()` periodicamente (cron 15:00 UTC) ou sob demanda (`POST /api/refresh`), grava o resultado no Postgres e aquece o Redis. `GET /api/props` apenas lê o último snapshot → resposta **< 50ms**.

---

## Estrutura de diretórios detalhada

```
nba-scout/
├── backend/
│   ├── pyproject.toml          # uv; deps prod + dev declaradas
│   ├── uv.lock                 # Lock file determinístico
│   ├── alembic.ini             # URL via $POSTGRES_URL
│   ├── Dockerfile              # Multi-stage; gunicorn+uvicorn; non-root
│   └── app/
│       ├── main.py             # FastAPI app; lifespan (engine/redis/httpx/arq); instrumentação Prometheus
│       ├── core/
│       │   ├── config.py       # Settings(BaseSettings): ODDS_API_KEY, POSTGRES_*, REDIS_URL, analyze_on_startup, cron_analysis_hour
│       │   ├── constants.py    # NBA_TOTAL_PLAYER_MIN=28, thresholds EV
│       │   ├── teams.py        # 30 times + helpers get_team_abbr(), normalize_team_name()
│       │   ├── logging.py      # structlog: JSON em prod, texto colorido em dev
│       │   ├── redis.py        # Singleton init/get/close (init_redis/get_redis/close_redis)
│       │   └── arq.py          # Singleton pool ARQ — lado produtor (init_arq_pool/get_arq_pool/close_arq_pool)
│       ├── analytics/
│       │   ├── ev.py           # LÓGICA CORE: estimate_true_probability, calculate_ev, calculate_kelly, classify_bet
│       │   ├── stats_parsing.py# games_over_line, get_last5_values, build_player_stats, _normalize_name
│       │   ├── matchup.py      # get_matchup_adjustment (def_rating), get_pace_adjustment
│       │   └── minutes.py      # estimate_minutes, get_minutes_adjustment
│       ├── db/
│       │   ├── base.py         # DeclarativeBase
│       │   ├── session.py      # async_sessionmaker; get_session() context manager; get_engine()
│       │   └── models/
│       │       ├── team.py         # Team (teams)
│       │       ├── player.py       # Player (players); normalized_name + GIN pg_trgm index
│       │       ├── game.py         # Game (games); nba_api_game_id, espn_event_id
│       │       ├── player_game_log.py # PlayerGameLog (player_game_logs); JSONB box_score — TABELA CENTRAL DW
│       │       ├── sync_state.py   # SyncState (sync_states); last_game_date por jogador
│       │       ├── analysis.py     # AnalysisSnapshot (analysis_snapshots); status, contagens, quota, duração
│       │       ├── prop.py         # AnalyzedProp (analyzed_props); ev_pct, kelly, rating, line
│       │       ├── line_snapshot.py# LineSnapshot (line_snapshots); histórico de odds
│       │       └── bet.py          # Bet (bets); bet tracker server-side
│       ├── schemas/
│       │   ├── prop.py         # PropOut (contrato atual da API), PlayerDetailOut
│       │   ├── status.py       # StatusOut: is_refreshing, last_run_at, quota_remaining
│       │   └── bet.py          # BetCreate, BetOut
│       ├── cache/
│       │   ├── keys.py         # Prefixo v1:; latest_snapshot(), analysis_status(), player_stats(id)
│       │   └── repository.py   # get_json(redis, key), set_json(redis, key, data, ttl), delete(redis, key)
│       ├── clients/
│       │   ├── base.py         # AsyncHTTPClient: httpx.AsyncClient, retry/backoff, Limits(20/10), timeout 30s
│       │   ├── espn.py         # get_player_index, get_player_gamelog, get_playoff_history, get_team_stats, get_injuries
│       │   ├── odds.py         # get_events, get_player_props; controle de quota Redis; Semaphore(3)
│       │   └── nba_live.py     # get_games_today, get_player_stats; run_in_executor para nba_api síncrono
│       ├── services/
│       │   ├── analysis.py     # analyze_day() async: Fase A (gather por jogo), Fase B (dedup+Semaphore(8)), Fase C (EV síncrono)
│       │   ├── players.py      # search_player (pg_trgm), get_player_detail
│       │   └── demo.py         # Dados sintéticos para offseason/geoblock
│       ├── routers/
│       │   ├── health.py       # GET /health, GET /health/ready (DB SELECT 1 + Redis ping)
│       │   └── props.py        # GET /api/props (cache-aside), POST /api/refresh (throttle NX 60s), GET /api/status
│       └── workers/
│           ├── settings.py     # WorkerSettings: on_startup, on_shutdown, functions, cron_jobs=[cron(15h UTC)]
│           └── tasks.py        # run_daily_analysis(ctx), sync_player_logs(ctx, player_id)
│
├── frontend/
│   ├── index.html              # Sem CDNs; fontes Google via <link>
│   ├── vite.config.ts          # proxy /api → localhost:8000 em dev (usa "vite", NÃO "vitest/config")
│   ├── vitest.config.ts        # SEPARADO de vite.config.ts (conflito de tipos vitest vs vite 8)
│   ├── .prettierrc.json        # printWidth 130, semi true, singleQuote false, trailingComma all
│   ├── tsconfig.app.json       # allowJs:true, checkJs:false (migração incremental)
│   └── src/
│       ├── main.tsx            # QueryClientProvider + App (sem inline components → react-refresh)
│       ├── App.tsx             # Placeholder C1; App.tsx real chega no C3 com HashRouter
│       ├── types/api.ts        # Prop (28 campos), PropsResponse, PlayerDetail, StatusResponse, Bet
│       ├── api/
│       │   ├── client.ts       # apiGet/apiPost com VITE_API_URL
│       │   └── queries.ts      # useProps (5min), usePlayer, useStatus (30s), useRefresh mutation
│       ├── lib/
│       │   ├── teams.ts        # TEAMS (15 times) + MARKETS (12 mercados) — de data.jsx
│       │   ├── format.ts       # fmtOdd/fmtPct/fmtProb/fmtKelly/normEv/normKelly — de atoms.jsx
│       │   ├── props.ts        # gameKey/playerTeam/applyFilters/applySort/computeMetrics/propKey
│       │   ├── csv.ts          # toCsv + exportCsv (download com BOM)
│       │   └── playerStats.ts  # getStatValue — handles PTS/REB/AST/FG3M/BLK/STL + combos PRA/PR/PA/RA/STOCKS
│       ├── components/atoms/index.tsx  # RatingBadge, QuotaBadge, Sparkline, MicroBar, SkeletonBlock,
│       │                               # Tooltip, FlashCell, TrendSparkline, Gauge
│       ├── hooks/
│       │   ├── useFavorites.ts  # useSyncExternalStore sobre localStorage (substitui CustomEvent bus)
│       │   ├── useTweaks.ts     # estado local+localStorage; postMessage guardado por if(window.parent!==window)
│       │   └── useIsMobile.ts   # useIsMobile(breakpoint=768)
│       └── styles/global.css   # CSS migrado do legado
│
├── docker/
│   ├── compose.yml             # Base: api, worker, postgres:16-alpine, redis:7-alpine, frontend
│   └── compose.override.yml    # Dev: uvicorn --reload, bind mounts, portas expostas
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml              # Lint+mypy+pytest (matrix 3.11/3.12) + build frontend → gate ci-success
│   │   └── build-push.yml      # Docker images → ghcr.io (SHA + semver + latest)
│   ├── dependabot.yml          # pip + npm + docker + actions (semanal)
│   └── CODEOWNERS
│
├── docs/
│   ├── ARCHITECTURE.md         # Documento técnico vivo de cada Passo
│   └── AI_CONTEXT.md           # Este arquivo
│
├── Makefile                    # make dev | test | lint | migrate | build | logs
├── .env.example                # Template com todas as variáveis
└── scripts/                    # Scripts utilitários (criação de issues, etc.)

# Legado (mantido até Passo 4/6):
├── api.py, scout.py, ev.py, stats.py, odds.py
├── static/                     # Frontend React/Babel legado
└── requirements.txt
```

---

## Fluxo de dados (estado atual — Passo 3 concluído)

```
POST /api/refresh
    ├── Redis NX lock "v1:app:refresh_lock" (TTL 60s — throttle)
    │       └── Se já existe → {"queued": false, "reason": "throttled"}
    └── pool.enqueue_job("run_daily_analysis") → Redis broker
              │
              └── Worker ARQ pega o job (latência < 1s)
                      │
                      └── analyze_day() async
                              ├── Fase A: asyncio.gather por jogo (Odds + ESPN simultâneos)
                              ├── Fase B: dedup player_ids + asyncio.gather com Semaphore(8)
                              └── Fase C: loop síncrono EV (ev.py intacto)
                                      │
                                      └── AnalysisSnapshot salvo no Postgres
                                      └── Redis: latest_snapshot deletado (invalida cache)
                                      └── Redis: analysis_status atualizado (quota, timestamp)

GET /api/props
    ├── Redis hit "v1:app:latest_snapshot"? → JSONResponse (TTL 120s) → < 5ms
    └── Miss → SELECT Postgres → serializa → SET Redis (TTL 120s) → < 50ms

GET /api/status
    └── SELECT analysis_snapshots ORDER BY id DESC LIMIT 1
    └── is_refreshing = (snapshot.status == "running")

GET /health/ready
    ├── SELECT 1 (Postgres)
    └── PING (Redis)
```

---

## Modelos de banco de dados

### Tabelas de data warehouse (leitura-intensiva)

**`player_game_logs`** — tabela central, ~350k linhas esperadas após backfill
```
id, player_id (FK), game_id (FK), season, game_date,
pts, reb, ast, fg3m, blk, stl, min,    ← campos materializados
box_score JSONB                          ← dados completos
```

**`players`**
```
id, full_name, normalized_name (GIN pg_trgm),
nba_api_id, espn_id, team_id (FK), position, is_active
```

**`games`**
```
id, nba_api_game_id, espn_event_id,
game_date, season, season_type (Regular Season | Playoffs),
home_team_id (FK), away_team_id (FK), home_score, away_score, is_playoff
```

### Tabelas de estado da aplicação (escrita-intensiva)

**`analysis_snapshots`**
```
id, generated_at, status (pending|running|ok|demo|error),
props_count, strong_count, games_count, quota_used,
duration_seconds, error_message, is_demo
```

**`analyzed_props`** — 1 linha por prop por análise
```
id, snapshot_id (FK), player_name, team_abbr, opponent_abbr,
market, line, direction, odd, prob_real, ev_pct, kelly, rating
```

**`line_snapshots`** — histórico de odds (substitui line_history.json)
```
id, player_name, market, line, odd, bookmaker, fetched_at
```

**`bets`** — bet tracker server-side (nova feature)
```
id, player_name, market, line, direction, odd, stake,
placed_at, result (pending|won|lost|push), actual_value
```

---

## Lógica de EV (`analytics/ev.py`) — preservada verbatim do legado

**`estimate_true_probability(gamelog, line, market, opponent_def_rating, team_pace, player_minutes_avg, is_playoffs, playoff_history)`**

1. Frequência histórica: `games_over_line(last_10) / 10`
2. Se playoffs + dados históricos (≥ 3 jogos): `prob = prob × 0.65 + prob_po_hist × 0.35`
3. Ajuste defesa: +4% (ruim ≥ 116), +2% (média ≥ 112), −3% (boa ≤ 110), −5% (elite ≤ 106)
4. Ajuste pace: +2% (alto ≥ 102), −2% (baixo ≤ 96)
5. Ajuste minutos: −3% se `player_minutes_avg < NBA_TOTAL_PLAYER_MIN` e market == "points"
6. Clamp: `max(0.25, min(0.85, prob))`

**`calculate_ev(prob_real, odd_decimal) → float`**
```python
return (prob_real * (odd - 1) - (1 - prob_real)) * 100
```

**`calculate_kelly(prob_real, odd_decimal) → float`**
```python
b = odd - 1
kelly = (prob_real * b - (1 - prob_real)) / b
return max(0.0, kelly / 4)  # Kelly fracionado conservador
```

**`classify_bet(ev_pct, prob_real) → str`**
- `STRONG`: ev_pct ≥ 8 AND prob_real ≥ 0.60
- `VALUE`: ev_pct ≥ 3
- `NEUTRAL`: ev_pct ≥ −1
- `AVOID`: ev_pct < −1

---

## Cache Redis — chaves e TTLs

| Chave | TTL | Conteúdo | Invalidação |
|---|---|---|---|
| `v1:app:latest_snapshot` | 120s | JSON do último AnalysisSnapshot + props | Deletada pelo worker após cada análise |
| `v1:app:analysis_status` | 24h | `{quota_remaining, last_run_at}` | Sobrescrita pelo worker |
| `v1:app:refresh_lock` | 60s | `"1"` — throttle do `/api/refresh` | Expira naturalmente |
| `v1:espn:player_index` | 24h | Lista de ~2000 jogadores ativos | Expira naturalmente |
| `v1:espn:injuries:{abbr}` | 1h | Lesões ativas por time | Expira naturalmente |
| `v1:espn:po_hist:{id}:{year}` | 7d | Stats de playoffs de temporadas anteriores | Expira naturalmente |
| `v1:odds:quota:remaining` | sem TTL | Contador de requests restantes | Decrementado a cada chamada |

---

## Configurações críticas (`app/core/config.py`)

```python
class Settings(BaseSettings):
    # API externa
    odds_api_key: str

    # PostgreSQL
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "nba_scout"
    postgres_password: str
    postgres_db: str = "nba_scout"

    # Redis
    redis_url: str = "redis://localhost:6379/0"
    arq_redis_url: str | None = None  # fallback para redis_url

    # Comportamento
    environment: str = "development"
    log_level: str = "INFO"
    analyze_on_startup: bool = False   # IMPORTANTE: False evita consumir quota no hot-reload
    cron_analysis_hour: int = 15       # hora UTC do cron diário

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)
```

---

## Decisões de design importantes

| Decisão | Escolha | Motivo |
|---|---|---|
| Package manager | `uv` | 10–100× mais rápido; lock file determinístico; sem conflitos de dep |
| ORM | SQLAlchemy 2.0 async + `asyncpg` | Type-safe (`Mapped[T]`); não bloqueia o event loop |
| Task queue | ARQ (não Celery) | Async-native; broker = Redis (sem RabbitMQ extra); cron embutido |
| Frontend | Vite + TypeScript incremental | `allowJs:true` permite migrar arquivo-a-arquivo sem reescrever tudo |
| Deploy | Decidir depois | Docker + ghcr.io montados agora; servidor quando houver domínio |
| `ev.py` | Verbatim do legado | Não tocar em código que funciona; 33 testes como rede de segurança |
| `analyze_on_startup` | `False` por padrão | Cada `uvicorn --reload` dispararia análise e consumiria quota |
| `fail-soft` no lifespan | Warn, não crash | Em dev, Redis/ARQ podem não estar rodando ainda |

---

## Armadilhas conhecidas

### 1. `Mapped[list]` sem tipo de elemento (SQLAlchemy 2.0)
`Mapped[list]` → SQLAlchemy infere `uselist=False` → erro `InvalidRequestError` com `lazy="dynamic"`.
**Fix:** sempre `Mapped[list[X]]` com `TYPE_CHECKING` import para evitar circular.

### 2. `pg_trgm` antes do índice GIN
A migration cria índice GIN trigram. Se `pg_trgm` não estiver instalada antes, falha silenciosamente.
**Fix:** `op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")` no topo de `upgrade()`.

### 3. `is_refreshing` false positive
Verificar Redis lock de throttle como proxy para "análise em andamento" causava false positive (lock expira em 60s, análise pode demorar mais).
**Fix:** `is_refreshing = (snapshot.status == "running")` — apenas consulta DB.

### 4. Closure em loop (`B023`) em `stats_parsing.py`
`def _g(idx)` dentro de loop capturava `stats_arr` como variável mutável.
**Fix:** `def _g(idx: int, arr=stats_arr)` — default arg vincula valor no momento da definição.

### 5. `nba_api` geobloqueada em servidores cloud
`stats.nba.com` bloqueia IPs fora dos EUA. Em dev local (WSL Ubuntu, Brasil) funciona. Em produção vai precisar de proxy ou modo demo.
**Mitigação:** `HTTPS_PROXY` no httpx + fallback para modo demo documentado.

### 6. Quota Odds API (500 req/mês)
Com cron rodando, pode esgotar a quota. Proteções em camadas: Semaphore(3) no client, checagem de quota < 10 antes da análise, throttle 60s no endpoint, cron configurável.

### 7. `vitest.config.ts` ≠ `vite.config.ts` (conflito de tipos)
Vitest empacota sua própria versão do Vite (rolldown) com tipos `Plugin<any>` incompatíveis com o Vite 8 do projeto.
**Fix:** dois arquivos separados — `vite.config.ts` usa `from "vite"`; `vitest.config.ts` usa `from "vitest/config"`. Nunca usar `/// <reference types="vitest/config" />` no `vite.config.ts`.

### 8. `useSyncExternalStore` para localStorage
O bus `CustomEvent` do legado (`favorites.jsx`) não sobrevivia a múltiplas abas.
**Fix:** `useSyncExternalStore(subscribe, getSnapshot)` com listener de `"storage"` no window — sincronização cross-tab nativa sem Redux ou Zustand.

### 9. `react-refresh` e exports não-componentes
`export const RATING_TOKENS = ...` no mesmo arquivo de componentes dispara warning do plugin react-refresh (espera só exports de componentes React).
**Fix:** manter constantes privadas ao módulo (sem export) ou movê-las para arquivo separado.

---

## Como rodar localmente (dev rápido)

```bash
# Pré-requisitos: Docker Engine, uv, Node 20+
cp .env.example .env
# Editar .env: ODDS_API_KEY e POSTGRES_PASSWORD

# Stack completa (Postgres + Redis + API + Worker)
make dev

# Frontend (em outro terminal)
make dev-frontend
# http://localhost:5173

# Só testes
make test

# Migrations
make migrate
```

---

## Estado do CI/CD

**`ci.yml`** (PR e push):
- Backend: uv sync → ruff check → ruff format --check → mypy → pytest (matrix 3.11/3.12)
- Postgres + Redis como `services:` no GitHub Actions (testes de integração reais, 101 testes)
- Frontend: npm ci → **eslint → prettier --check → tsc -b → vitest run → build** (adicionado no C1)
- Gate `ci-success` necessário para merge

**`build-push.yml`** (push main + tags `v*`):
- Imagens `ghcr.io/nba-scout/analyzernbascouts-{api,frontend}:{sha,semver,latest}`
- Cache de layers `type=gha`

**Branch flow:** `feat/*` → `develop` → `main`

---

## Próximos passos concretos (Passo 6 C2 e C3)

### C2 — Dashboard (próximo PR)
Branch nova a partir de `develop` após merge de #33 e #34.
- `src/pages/Dashboard/` a partir de `static/dashboard.jsx` (1262 linhas)
- Componentes: `FilterBar`, `SummaryStrip`/`MetricCard`, `AccordionPanel`, `PropCard`, `FeaturedCard`, `InjuryAlert`, `MobilePropList`
- **3 variações de view**: `PropsTableTerminal` / `PropsCards` / `PropsEditorial`
- `RefreshCountdown` mantido como UI mas backed por `queryClient.invalidateQueries` (não mais `setInterval`)
- Tweaks panel: `static/tweaks-panel.jsx` → `src/components/tweaks/*` + `useTweaks`
- Dados via `useProps`; filtros persistidos em localStorage
- **Modelo recomendado: Opus** (migração complexa com múltiplas variações e estado)

### C3 — Player + App shell + Docker (terceiro PR)
- `src/pages/Player/` a partir de `static/player.jsx` (734 linhas)
- `App.tsx` final com `HashRouter` (preserva `#player/Nome` de URLs legadas)
- `frontend/Dockerfile` multi-stage (node build → nginx:1.27-alpine) + `nginx.conf` (SPA fallback + proxy `/api`)
- `main.tsx` monta `QueryClientProvider` + `App` definitivos
- **Sem cutover aqui**: legado (`static/` + mount em `api.py`) permanece até paridade validada
- **Modelo recomendado: Sonnet** (segue padrões estabelecidos no C2; Docker é mecânico)

### Depois do Passo 6
1. **Cutover** — remover `StaticFiles` mount do `api.py`, deletar `static/` (commit isolado, reversível)
2. **CSV do Kaggle** — quando o usuário fornecer `games_details.csv` + `games.csv` → `ingest_kaggle()`
3. **Deploy** — quando houver servidor + domínio escolhidos

---

## Glossário técnico

| Termo | Significado no projeto |
|---|---|
| **EV%** | Valor Esperado percentual de uma aposta (positivo = vantagem sobre a casa) |
| **Kelly fracionado** | Sugestão de stake conservadora (Kelly completo / 4) |
| **ARQ** | Biblioteca Python de task queue async, usa Redis como broker |
| **Lifespan** | Context manager async do FastAPI que roda código no startup/shutdown da app |
| **Cache-aside** | Padrão onde a app tenta Redis primeiro; em miss, vai ao DB e popula o Redis |
| **pg_trgm** | Extensão PostgreSQL para busca fuzzy por trigramas (usado no match de nomes de jogadores) |
| **Snapshot** | Registro de uma execução de `analyze_day()` — 1 linha na tabela `analysis_snapshots` |
| **Fail-soft** | Serviço indisponível → log de warning, não crash; funcionalidade degradada mas API no ar |
| **NX lock** | `SET key value NX EX ttl` — só cria a chave se não existir; usado para throttle |
| **Data warehouse** | Postgres com histórico de 10 temporadas (~350k linhas `player_game_logs`) para análise offline |
