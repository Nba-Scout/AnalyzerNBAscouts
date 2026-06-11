"""Script temporário para criar as 3 issues detalhadas no GitHub."""
import sys, json, urllib.request, urllib.error, subprocess

# Pega o token do git credential store
result = subprocess.run(
    ["git", "credential", "fill"],
    input="protocol=https\nhost=github.com\n",
    capture_output=True, text=True
)
TOKEN = ""
for line in result.stdout.splitlines():
    if line.startswith("password="):
        TOKEN = line.split("=", 1)[1].strip()
        break

if not TOKEN:
    print("❌ Token não encontrado")
    sys.exit(1)

REPO = "Nba-Scout/AnalyzerNBAscouts"
BASE = f"https://api.github.com/repos/{REPO}/issues"


def create_issue(title, body, labels=None):
    data = {"title": title, "body": body}
    if labels:
        data["labels"] = labels
    req = urllib.request.Request(
        BASE,
        data=json.dumps(data).encode(),
        headers={
            "Authorization": f"token {TOKEN}",
            "Content-Type": "application/json",
            "Accept": "application/vnd.github.v3+json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as r:
            res = json.loads(r.read())
            print(f"OK #{res['number']} — {res['html_url']}")
            return res
    except urllib.error.HTTPError as e:
        body_err = e.read().decode()
        print(f"ERR {e.code}: {body_err[:300]}")
        return None


# ── ISSUE 1: Passo 1 — Fundação ───────────────────────────────────────────────

body1 = """## Objetivo

Transformar o MVP monolítico síncrono (`api.py` + `scout.py` raiz) em um monorepo profissional com backend FastAPI async, banco de dados PostgreSQL, fila de tarefas ARQ, Docker e CI/CD. Este Passo estabelece toda a fundação estrutural sem modificar a lógica de negócio já funcional.

---

## Contexto: estado anterior

| Problema | Impacto |
|---|---|
| Backend 100% síncrono (`requests`) | `GET /api/props` bloqueava 40–120s |
| Sem banco de dados | Persistência só em `.cache/*.json` |
| Frontend compilado no browser via Babel CDN | Sem build step, sem TypeScript |
| Zero Docker, CI/CD, testes | Não reproduzível fora da máquina local |

---

## Arquivos criados / modificados

### `backend/pyproject.toml`
Gestão de dependências migrada de `requirements.txt` para `uv`.

**Deps de produção:** `fastapi>=0.115`, `uvicorn[standard]`, `gunicorn`, `pydantic>=2.9`, `pydantic-settings`, `sqlalchemy>=2.0.36`, `asyncpg`, `alembic`, `redis>=5.2`, `arq>=0.26`, `httpx>=0.28`, `pandas>=2.2`, `nba_api`, `structlog`, `prometheus-fastapi-instrumentator`

**Dev:** `pytest`, `pytest-asyncio`, `respx`, `ruff`, `mypy`, `pre-commit`

Removidos: `anthropic` (dead dep) e `python-dotenv` (substituído por pydantic-settings).

---

### `backend/app/core/`

| Arquivo | Conteúdo |
|---|---|
| `config.py` | `Settings(BaseSettings)` lendo `.env` via pydantic-settings. Campos: `ODDS_API_KEY`, `POSTGRES_*`, `REDIS_URL`, `ENVIRONMENT`, `LOG_LEVEL`, `analyze_on_startup`, `cron_analysis_hour` |
| `constants.py` | `NBA_TOTAL_PLAYER_MIN = 28`, limites de EV, thresholds de classificação |
| `teams.py` | 30 times NBA + helpers `get_team_abbr()`, `normalize_team_name()` |
| `logging.py` | structlog — JSON estruturado em produção, texto colorido em dev |
| `redis.py` | Singleton `init_redis()` / `get_redis()` / `close_redis()` |

---

### `backend/app/analytics/`

**`ev.py`** — preservado verbatim do legado:
- `estimate_true_probability()` — Normal CDF + blend playoffs (0.65/0.35) + ajuste defesa/pace/minutos + clamp [25%, 85%]
- `calculate_ev()`, `calculate_kelly()`, `classify_bet()` (`STRONG` / `VALUE` / `NEUTRAL` / `AVOID`)

**`stats_parsing.py`** — funções puras extraídas do `stats.py` legado:
- `games_over_line(history, line, market)` — frequência histórica sobre a linha
- `get_last5_values(history, market)` — últimos 5 valores brutos para display

---

### `backend/app/db/models/` — 9 modelos SQLAlchemy 2.0 async

| Modelo | Tabela | Propósito |
|---|---|---|
| `Team` | `teams` | 30 franquias NBA |
| `Player` | `players` | Jogadores ativos; `normalized_name` + índice GIN pg_trgm para fuzzy search por nome |
| `Game` | `games` | Partidas; `nba_api_game_id`, `espn_event_id`, `season_type` (Regular/Playoffs) |
| `PlayerGameLog` | `player_game_logs` | **Tabela central do DW** — 1 linha por jogador × jogo; JSONB `box_score` |
| `SyncState` | `sync_states` | Rastreia último sync incremental de cada jogador |
| `AnalysisSnapshot` | `analysis_snapshots` | 1 linha por run de `analyze_day()` — status, contagens, quota, duração |
| `AnalyzedProp` | `analyzed_props` | Resultado por prop (substitui `partial_results.json`) |
| `LineSnapshot` | `line_snapshots` | Histórico de odds (substitui `line_history.json`); upsert ON CONFLICT |
| `Bet` | `bets` | Bet tracker server-side (nova feature) |

---

### `backend/alembic/`

- `alembic.ini` — URL via variável de ambiente `POSTGRES_URL`
- `alembic/env.py` — `async_engine_from_config` + `run_sync` (migrations async-safe)
- `alembic/script.py.mako` — template padrão Alembic (ausente causaria `FileNotFoundError` em `revision --autogenerate`)

---

### `backend/app/main.py` + stubs com contratos definidos

- `app/main.py` — FastAPI app com lifespan stub (TODO preenchido no Passo 3)
- `app/routers/health.py` — `/health` e `/health/ready`
- `app/routers/props.py` — stubs `/api/props`, `/api/refresh`, `/api/status`
- `app/schemas/` — `PropOut`, `PlayerDetailOut`, `StatusOut`, `BetCreate/Out` (Pydantic v2)
- `app/cache/keys.py` + `repository.py` — prefixo `v1:`, `get_json`/`set_json` com TTL
- `app/workers/settings.py` + `tasks.py` — `WorkerSettings` + `run_daily_analysis` stubs

---

### `backend/tests/unit/test_ev.py`

**33 testes cobrindo toda a lógica de `ev.py`:**

```
Normal CDF: 0.0→50%, 1.645→95%, -∞→0%
estimate_true_probability: base case, playoffs blend, clamp inferior (25%), superior (85%)
Ajuste defesa: ruim (+4%), média (+2%), boa (-3%), elite (-5%)
Ajuste pace: alto (+2%), baixo (-2%)
Ajuste minutos: <28 min + pontos → -3%
calculate_ev: EV positivo, negativo, zero
calculate_kelly: stake positiva, negativa (→0), fracionado /4
classify_bet: STRONG, VALUE, NEUTRAL, AVOID
```

```bash
cd backend && python -m pytest tests/unit/test_ev.py -v
# 33 passed in 0.14s ✅
```

---

### `docker/compose.yml` + `compose.override.yml`

**Base (prod-like):** `api` (gunicorn+uvicorn, healthcheck `/health`), `worker` (mesma imagem, command `arq ...`), `postgres:16-alpine` (volume `pgdata`), `redis:7-alpine` (volume `redisdata`), `frontend` (nginx + proxy `/api`)

**Override dev:** `uvicorn --reload`, bind mounts, portas expostas (8000, 5432, 6379)

---

### `frontend/` — scaffold Vite react-ts

- `allowJs: true`, `checkJs: false` — migração incremental `.jsx → .tsx`
- `vite.config.ts` — proxy `/api → http://localhost:8000`
- CSS migrado do legado para `src/styles/global.css`
- Build limpo: **✓ built in 172ms**

---

### `.github/workflows/`

**`ci.yml`** (PR + push main):
- Job `backend`: uv sync → ruff → mypy → pytest com matrix Python 3.11/3.12; Postgres + Redis como `services:`
- Job `frontend`: npm ci → eslint → `tsc --noEmit` → vitest → build
- Gate `ci-success` para branch protection

**`build-push.yml`** (push main + tags `v*`): `docker/build-push-action` + buildx, push `ghcr.io` com SHA+semver+latest, cache `type=gha`

---

## Verificação

```bash
# Testes
cd backend && python -m pytest tests/unit/test_ev.py -v
# → 33 passed in 0.14s ✅

# Build frontend
cd frontend && npm run build
# → ✓ built in 172ms ✅

# Lint
cd backend && ruff check . && ruff format --check .
# → All checks passed ✅
```

---

## Decisões de design

| Decisão | Escolha | Motivo |
|---|---|---|
| Package manager | `uv` | 10–100× mais rápido que pip; lock file determinístico |
| Tipagem DB | SQLAlchemy 2.0 `Mapped[T]` | Type-safe; mypy-friendly sem plugins extras |
| Lógica de negócio | `ev.py` verbatim | Não tocar em código que funciona; testes primeiro como rede de segurança |
| Stubs com contratos | `main.py` + routers com TODO | Compila e passa no CI; implementação nos Passos seguintes |
| Frontend incremental | `allowJs: true` | Evita reescrever 3000 linhas JSX de uma vez |

---

**Branch:** `main` | **Data:** 2026-06-02 | **Testes:** 33/33 ✅ | **CI:** verde em 3.11 e 3.12 ✅"""

# ── ISSUE 2: Passo 2 ──────────────────────────────────────────────

body2 = """## Objetivo

Migrar o backend de 100% síncrono (`requests`) para 100% async (`httpx`), reescrevendo `analyze_day()` com `asyncio.gather` em 3 fases paralelas. Resultado: análise cai de 40–120s para < 10s.

---

## Contexto: por que async

O legado fazia loop sequencial: para cada jogo → busca props (Odds API) → busca roster → busca lesões → busca defesa → para cada jogador → busca stats (ESPN API). Com 5 jogos e 15 jogadores únicos: ~100 chamadas HTTP bloqueantes em série.

Com `asyncio.gather` + semáforos: todas as chamadas por fase rodam em paralelo, limitadas por semáforo para não abusar as APIs.

---

## Arquivos criados / modificados

### `backend/app/clients/base.py` — cliente HTTP base

`AsyncHTTPClient` wrapping `httpx.AsyncClient` com:
- `Limits(max_connections=20, max_keepalive_connections=10)` — pool de conexões
- Retry/backoff exponencial: 3 tentativas com delays `[1s, 2s, 4s]`
- Timeout global de 30s
- Hook `on_response` para logging e métricas
- `get_client()` / `close_client()` — singleton gerenciado no lifespan

Fix SIM105: `try/except/pass` → `contextlib.suppress(Exception)`

---

### `backend/app/clients/espn.py`

Reescrita async completa de `stats.py` (I/O puro):
- `get_player_index()` — índice de ~2000 jogadores ativos
- `get_player_gamelog(player_id, season)` — últimos N jogos com box score
- `get_playoff_history(player_id, year)` — stats de playoffs de temporadas anteriores
- `get_team_stats()` — pace e defensive rating de todos os times
- `get_injuries(team_abbr)` — lesões ativas por time
- Cache Redis integrado (TTLs: player_index 24h, injuries 1h, po_hist 7d)

---

### `backend/app/clients/odds.py`

Reescrita async de `odds.py`:
- `get_events(sport, region, markets)` — eventos do dia via The Odds API v4
- `get_player_props(event_id, markets)` — props por jogo
- Controle de quota: lê/escreve `v1:odds:quota:remaining` no Redis após cada chamada
- Semáforo dedicado `Semaphore(3)` para respeitar rate limits

---

### `backend/app/clients/nba_live.py`

Wrapper async para `nba_api` (biblioteca síncrona):
- `get_games_today()` — jogos do dia via `scoreboardv2`
- `get_player_stats(player_id)` — stats recentes
- Todas as chamadas via `asyncio.get_event_loop().run_in_executor(None, ...)` para não bloquear o event loop

---

### `backend/app/analytics/matchup.py`

Extraído de `scout.py` — lógica de matchup pura (CPU, sem I/O):
- `get_matchup_adjustment(def_rating, league_avg=112.0)` — +4%/+2%/−3%/−5% por qualidade da defesa
- `get_pace_adjustment(pace, league_avg)` — +2–3% pace alto, −2% pace baixo

---

### `backend/app/analytics/minutes.py`

Extraído de `scout.py` — cascata de minutos:
- `estimate_minutes(player_id, gamelog, roster_context)` — estima minutos esperados
- Considera lesões do time, starters históricos, minutos médios dos últimos 5 jogos
- `get_minutes_adjustment(estimated_minutes, market)` — −3% para < 28 min em props de volume

---

### `backend/app/services/analysis.py` — `analyze_day()` async

Reescrita completa em 3 fases:

**Fase A** — por jogo em paralelo (`asyncio.gather`):
```python
results = await asyncio.gather(*[
    asyncio.gather(
        clients.odds.get_player_props(game_id, markets),
        clients.espn.get_injuries(home_abbr),
        clients.espn.get_injuries(away_abbr),
        clients.espn.get_team_stats(),
    )
    for game_id, home_abbr, away_abbr in games
])
```

**Fase B** — dedup de player_ids → busca stats 1× cada com `Semaphore(8)`:
```python
sem = asyncio.Semaphore(8)
async def fetch_one(player_id):
    async with sem:
        return await clients.espn.get_player_gamelog(player_id)

stats_map = dict(zip(unique_ids, await asyncio.gather(*[fetch_one(pid) for pid in unique_ids])))
```

**Fase C** — EV é CPU-puro, loop síncrono reutilizando `ev.py` intacto:
```python
for prop in all_props:
    prob = ev.estimate_true_probability(stats_map[prop.player_id], prop.line, ...)
    prop.ev_pct = ev.calculate_ev(prob, prop.odd)
    prop.rating = ev.classify_bet(prop.ev_pct, prob)
```

Checagem de quota antes de Fase A: se `quota_remaining < 10` → ativa modo demo automaticamente.

---

### `backend/app/services/players.py`

- `search_player(name)` — fuzzy search via pg_trgm no Postgres
- `get_player_detail(player_id)` — stats completas + histórico playoffs + props recentes
- Removido: `import json` (F401)

---

### `backend/app/services/demo.py`

Modo demo com dados sintéticos para quando The Odds API não tem eventos (offseason/geoblock):
- Gera 5 jogos fictícios com props realistas
- Reutiliza `ev.py` intacto para cálculos
- Removido: `NBA_TOTAL_PLAYER_MIN` (F401)

---

### `backend/app/analytics/stats_parsing.py` — extensão

Adicionadas:
- `build_player_stats(gamelog)` — monta dict de stats a partir do gamelog ESPN
- `_normalize_name(name)` — remove acentos, pontuação, sufixos Jr/II/III para fuzzy match

Fix B023 — closure em loop capturava variável mutável:
```python
# Antes (bug silencioso):
def _g(idx: int) -> Any:
    return stats_arr[idx]  # stats_arr muda a cada iteração do loop

# Depois (correto):
def _g(idx: int, arr=stats_arr) -> Any:  # default arg vincula valor atual
    return arr[idx]
```

---

### Ruff conformance — 39 arquivos reformatados

Toda a base de código do Passo 1 + Passo 2 nunca havia sido processada por `ruff format`. Aplicado em 39 arquivos incluindo `ev.py`. Segurança verificada: **94 testes passando após reformatação** (matemática intacta).

Correções de lint aplicadas:
- `I001` (imports não ordenados) — `analysis.py:276`, `tasks.py:20`
- `SIM105` (try-except-pass) — `analysis.py:365`, `base.py`
- `F401` (imports não usados) — `demo.py`, `players.py`
- `UP017` (timezone.utc) — `tasks.py` (×3): `from datetime import UTC` + `UTC` em vez de `timezone.utc`
- `B023` (closure em loop) — `stats_parsing.py`
- `E402` — adicionado `per-file-ignores` para `tests/**/*.py`

---

## Verificação

```bash
cd backend

# Todos os testes
python -m pytest tests/unit/ -v
# → 94 passed ✅

# Lint completo
ruff check . && ruff format --check .
# → All checks passed ✅
```

---

## Resultado de performance

| Operação | Antes | Depois |
|---|---|---|
| `analyze_day()` com 5 jogos | 40–120s | < 10s |
| Busca stats (15 jogadores únicos) | Sequencial | Paralela com Semaphore(8) |
| Chamadas Odds API | Sequencial por jogo | Paralela com Semaphore(3) |
| Bloqueio do event loop | nba_api bloqueava | `run_in_executor` |

---

**Branch:** `feat/passo-2-async` → `develop` | **Data:** 2026-06-11 | **Testes:** 94/94 ✅ | **CI:** verde ✅"""

# ── ISSUE 3: Passo 3 ──────────────────────────────────────────────

body3 = """## Objetivo

Conectar todas as peças: ligar o lifespan do FastAPI (DB + Redis + httpx + ARQ), implementar os endpoints reais com cache-aside Redis e throttle, configurar o worker ARQ com cron, criar a migration Alembic inicial com `pg_trgm`, e validar o pipeline ponta-a-ponta via Docker Compose.

---

## Arquivos criados / modificados

### `backend/app/core/arq.py` *(NOVO)*

Singleton do pool ARQ — lado produtor (API enfileira, worker consome):

```python
_pool: ArqRedis | None = None

async def init_arq_pool() -> ArqRedis:
    global _pool
    cfg = get_settings()
    url = cfg.arq_redis_url or cfg.redis_url
    _pool = await create_pool(RedisSettings.from_dsn(url))
    return _pool

async def close_arq_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None
```

Padrão init/get/close idêntico ao `core/redis.py` para consistência.

---

### `backend/app/core/config.py` — 2 campos adicionados

```python
analyze_on_startup: bool = False   # evita consumo de quota no hot-reload em dev
cron_analysis_hour: int = 15       # hora UTC do cron diário (padrão: 15:00 UTC)
```

`analyze_on_startup = False` é crítico: sem isso, cada `uvicorn --reload` dispararia uma análise completa consumindo quota da Odds API.

---

### `backend/app/main.py` — lifespan completo

Substituído o stub TODO por lifespan async real com **fail-soft pattern**:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP
    engine = get_engine()      # engine async (conexão lazy)
    get_client()               # httpx AsyncClient de processo-longo

    try:
        await init_redis(cfg.redis_url)
    except Exception:
        log.warning("Redis indisponível — continuando sem cache")

    try:
        await init_arq_pool()
    except Exception:
        log.warning("ARQ indisponível — /api/refresh desabilitado")

    if cfg.analyze_on_startup:
        pool = get_arq_pool()
        if pool:
            await pool.enqueue_job("run_daily_analysis")

    yield

    # SHUTDOWN
    await close_arq_pool()
    await close_redis()
    await close_client()
    await engine.dispose()
```

Fail-soft: Redis e ARQ indisponíveis não crasham a API — apenas desabilitam cache/queue. Útil em dev.

---

### `backend/app/routers/props.py` — implementação completa

**`GET /api/props`** — padrão cache-aside Redis:
```python
# 1. Tenta Redis (TTL 120s)
cached = await repository.get_json(redis, keys.latest_snapshot())
if cached:
    return JSONResponse(cached)

# 2. Miss → busca no Postgres
snapshot = await get_latest_snapshot_with_props(session)

# 3. Aquece o cache
await repository.set_json(redis, keys.latest_snapshot(), payload, ttl=120)
return JSONResponse(payload)
```

**`POST /api/refresh`** — throttle via Redis NX lock:
```python
locked = await redis.set("v1:app:refresh_lock", "1", nx=True, ex=60)
if not locked:
    return {"queued": False, "reason": "throttled"}

await pool.enqueue_job("run_daily_analysis")
return {"queued": True}
```

**`GET /api/status`** — apenas consulta DB:
```python
# is_refreshing: verifica SOMENTE snapshot.status == "running" no DB
# NÃO verifica Redis lock — isso causava false positive (lock de throttle != análise em andamento)
```

---

### `backend/app/routers/health.py` — Redis adicionado ao readiness check

`/health/ready` agora verifica DB (`SELECT 1`) + Redis (`ping()`) e reporta cada um individualmente.

---

### `backend/app/workers/settings.py` — implementação completa

```python
async def on_startup(ctx: dict) -> None:
    get_engine()        # engine async
    get_client()        # httpx AsyncClient
    await init_redis(cfg.redis_url)

async def on_shutdown(ctx: dict) -> None:
    await close_redis()
    await close_client()
    await engine.dispose()

class WorkerSettings:
    functions = [run_daily_analysis, sync_player_logs]
    on_startup = on_startup
    on_shutdown = on_shutdown
    cron_jobs = [cron(run_daily_analysis, hour=get_settings().cron_analysis_hour, minute=0)]
```

O worker tem ciclo de vida próprio — independente do lifespan do FastAPI.

---

### `backend/app/workers/tasks.py` — invalidação de cache pós-análise

```python
# Após session.commit():
redis = get_redis()
if redis is not None:
    await repository.delete(redis, keys.latest_snapshot())   # invalida cache
    await repository.set_json(redis, keys.analysis_status(), {
        "quota_remaining": result.get("quota_remaining"),
        "last_run_at": datetime.now(UTC).isoformat(),
    }, ttl=24 * 3600)
```

---

### `backend/alembic/versions/a3855278d889_initial_schema.py` *(NOVO)*

Migration com 9 tabelas. Adição manual no topo de `upgrade()`:

```python
def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")  # antes do índice GIN
    # ... criação das 9 tabelas ...
    op.create_index(
        "ix_players_normalized_name_trgm",
        "players", ["normalized_name"],
        postgresql_using="gin",
        postgresql_ops={"normalized_name": "gin_trgm_ops"},
    )
```

`pg_trgm` deve existir **antes** do índice GIN. Sem o `op.execute`, a migration falharia silenciosamente em Postgres sem a extensão pré-instalada.

---

### Fix: SQLAlchemy 2.0 `Mapped[list]` sem tipo de elemento

**Problema:** `Mapped[list]` → SQLAlchemy 2.0 infere `uselist=False` → rejeita `lazy="dynamic"` com `InvalidRequestError`.

**Correção nos 3 modelos (`analysis.py`, `player.py`, `game.py`):**

```python
# Antes (bug):
props: Mapped[list] = relationship("AnalyzedProp", lazy="dynamic")

# Depois (correto):
if TYPE_CHECKING:
    from app.db.models.prop import AnalyzedProp

props: Mapped[list[AnalyzedProp]] = relationship("AnalyzedProp", lazy="select")
```

Pattern `TYPE_CHECKING`: import ocorre apenas em time-check (mypy/pyright), não em runtime. Evita import circular. Resolve tensão entre ruff `UP037` (sem strings em anotações) e `F821` (nome indefinido).

---

## Validação ponta-a-ponta (Docker Compose)

Pipeline completo testado em WSL Ubuntu com Docker Engine:

```bash
# Subir stack
docker compose -f docker/compose.yml -f docker/compose.override.yml up -d

# POST /api/refresh
curl -X POST http://localhost:8000/api/refresh
# → {"queued": true}

# POST /api/refresh imediato (throttle)
curl -X POST http://localhost:8000/api/refresh
# → {"queued": false, "reason": "throttled"}
```

**Worker log observado:**
```
Worker ARQ iniciado.
[job a3f2...] run_daily_analysis() → picked up in 0.16s
Falha ao buscar jogos via nba_api  (geoblock offseason — esperado)
Odds API sem eventos — ativando modo demo
AnalysisSnapshot id=1: status=running → status=ok, duration_s=1.69
Cache invalidado: v1:app:latest_snapshot deletado
```

```bash
# Status após análise
curl http://localhost:8000/api/status
# → {"is_refreshing": false, "cached_at": "2026-06-11T...", "quota_remaining": 500}

# Props — primeira chamada (DB)
curl http://localhost:8000/api/props
# → {"generated_at": "2026-06-11T...", "props": [...]}

# Props — segunda chamada (Redis cache hit, < 5ms)
curl http://localhost:8000/api/props
```

---

## Fluxo completo de dados

```
POST /api/refresh
    └─▶ Redis NX lock (throttle 60s)
    └─▶ pool.enqueue_job("run_daily_analysis") → Redis broker
              └─▶ Worker ARQ pega o job (< 1s)
              └─▶ analyze_day() async (Fase A/B/C)
              └─▶ AnalysisSnapshot gravado no Postgres
              └─▶ Redis: v1:app:latest_snapshot → DELETADO
              └─▶ Redis: v1:app:analysis_status → ATUALIZADO

GET /api/props
    └─▶ v1:app:latest_snapshot no Redis? → retorna (TTL 120s) < 5ms
    └─▶ Miss → SELECT Postgres → serializa → SET Redis (TTL 120s)
    └─▶ resposta < 50ms (vs 40–120s do legado)
```

---

## Verificação

```bash
cd backend && python -m pytest tests/ -v
# → 94 passed ✅

curl http://localhost:8000/health/ready
# → {"db": "ok", "redis": "ok"}

cd backend && ruff check . && ruff format --check .
# → All checks passed ✅
```

---

**Branch:** `feat/passo-3-infra` | **Data:** 2026-06-11 | **Testes:** 94/94 ✅ | **Docker E2E:** validado ✅"""

r1 = create_issue(
    "feat: Passo 1 — Fundação (monorepo, FastAPI, SQLAlchemy 2.0, Docker, CI/CD)",
    body1, ["enhancement"]
)
r2 = create_issue(
    "feat: Passo 2 — Async + Paralelização (httpx, asyncio.gather, clientes, testes)",
    body2, ["enhancement"]
)
r3 = create_issue(
    "feat: Passo 3 — Integração de Infraestrutura (lifespan, ARQ, cache-aside, migrations, Docker E2E)",
    body3, ["enhancement"]
)

if all([r1, r2, r3]):
    print("\nTodas as 3 issues criadas com sucesso!")
else:
    print("\nAlguma issue falhou.")
