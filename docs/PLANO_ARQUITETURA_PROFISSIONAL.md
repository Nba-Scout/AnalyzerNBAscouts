# NBA Scout — Plano de Transformação para Arquitetura Profissional

> **Status:** Plano aprovado em 2026-06-01. **Nada implementado ainda** — este documento é o blueprint.
> **Objetivo:** Elevar o NBA Scout de um MVP monolítico funcional para uma arquitetura de produção de grande escala ("overengineering" pedido pelo usuário): backend separado do frontend via API, processamento assíncrono, fila de tarefas, banco de dados, cache distribuído, containerização e CI/CD completo.

---

## 1. Sumário Executivo

O NBA Scout analisa props (apostas de jogador) da NBA, calcula Expected Value (EV), probabilidade real e fração de Kelly, e apresenta tudo num dashboard. Hoje funciona, mas a estrutura é amadora e não escala.

Este plano reorganiza o projeto em **monorepo profissional** (`backend/` + `frontend/`), torna o backend **assíncrono e paralelo** (a análise cai de 40-120s para poucos segundos), move o processamento pesado para uma **fila em background** (worker agendado), introduz **PostgreSQL** (histórico, bet tracker) e **Redis** (cache + broker), **containeriza** tudo com Docker e monta um **pipeline de CI/CD** completo no GitHub Actions.

**Princípio central — inversão do fluxo:** a análise pesada deixa de rodar quando o usuário abre a página. Um *worker* a executa periodicamente em segundo plano e grava o resultado no banco; o endpoint `GET /api/props` apenas **lê** esse resultado pronto, respondendo em menos de 50 milissegundos.

---

## 2. Diagnóstico do Estado Atual

### 2.1 Backend (Python, na raiz do projeto)
- **Framework:** FastAPI + Uvicorn, porta 8000, só `127.0.0.1` (não acessível externamente).
- **Módulos:** `api.py` (2 endpoints), `scout.py` (orquestrador `analyze_day()`), `stats.py` (APIs ESPN: gamelog, lesões, defesa), `odds.py` (The Odds API), `ev.py` (cálculo de EV/Kelly/probabilidade), `config.py` (constantes + env vars), `demo.py` (fallback de props sintéticas), `main.py`/`interactive.py`/`report.py` (CLI com Rich).
- **100% SÍNCRONO** (`requests`). `analyze_day()` faz um loop sequencial: para cada jogo → para cada jogador → 5-6 chamadas HTTP bloqueantes (`get_player_id`, `get_player_recent_stats`, `get_player_playoff_history`, `get_team_injuries`, `get_matchup_defense`, `get_props_for_game`).
- **Gargalo medido:** ~7-15 jogadores × ~6-8s cada = **40 a 120 segundos por análise**, tudo no request-path do `GET /api/props`.
- **Sem banco de dados.** Persistência só em arquivos JSON no `.cache/`:
  - `player_index.json` (índice nome→ID, TTL 24h)
  - `team_stats.json` (TTL 24h)
  - `line_history.json` (linhas de abertura, para detectar movimento)
  - `po_hist_{id}_{ano}.json` (histórico de playoffs)
  - `partial_results.json` (último run bem-sucedido, usado como fallback)
  - `injuries_{time}.json` (TTL 1h), `roster_{time}.json`
- **Dependências:** `nba_api`, `requests`, `python-dotenv`, `rich`, `anthropic` (não usada — dead dependency), `pandas`, `beautifulsoup4`, `lxml`, `cloudscraper`, `questionary`.

### 2.2 Frontend (`static/`)
- **Sem build step.** React 18.3.1 + ReactDOM + Babel Standalone 7.29.0 carregados via CDN (unpkg). O JSX é compilado **em tempo real no navegador** (`<script type="text/babel">`).
- **~3.000 linhas** em 7 arquivos `.jsx`: `app.jsx` (shell/router, 150), `atoms.jsx` (componentes, 300), `dashboard.jsx` (1.358 — o maior), `data.jsx` (estado global, 91), `favorites.jsx` (60), `player.jsx` (777), `tweaks-panel.jsx` (425).
- **Padrão de globals:** sem imports ES. Cada arquivo expõe via `window.NBA_DATA = {...}` ou `Object.assign(window, {...})`. A ordem dos `<script>` no `index.html` É o grafo de dependências.
- **Comunicação:** `fetch` relativo em `/api/props` (data.jsx) e `/api/player/{name}` (player.jsx).
- **Persistência client-side:** `localStorage` (`nba-scout-filters`, `nba-scout-favorites`), roteamento por `window.location.hash`.

### 2.3 Infraestrutura
- **Zero.** Sem Dockerfile, docker-compose, `.github/workflows`, testes, Makefile, IaC.
- Git inicializado (branch `main`), `.gitignore` cobre `.env`, `.cache/`, logs, `__pycache__`.
- Roda só local via `python api.py`.

---

## 3. Decisões de Arquitetura (confirmadas)

| Decisão | Escolha | Justificativa |
|---|---|---|
| **Plataforma de deploy** | **Decidir depois** | Montar Docker + Compose + CI + build de imagens para o GitHub Container Registry (ghcr.io) agora. O workflow de deploy (`deploy.yml`) fica como template/stub documentado; setup de servidor e Terraform ficam adiados até existir servidor + domínio. |
| **Fila de tarefas** | **ARQ** | Async-native (combina com a migração para FastAPI async + httpx), usa apenas o Redis que já teremos (sem broker extra como RabbitMQ), e tem cron embutido (dispensa um processo Celery Beat separado). |
| **Frontend** | **TypeScript incremental** | Vite scaffolded como projeto TS com `allowJs: true`. Componentes migram primeiro como `.jsx` (build funciona logo), depois tipa-se as fronteiras da API e converte-se arquivo-a-arquivo. Entrega ~80% do valor de tipos com baixo risco, sem reescrever 3.000 linhas de uma vez. |
| **Escopo** | **Tudo de uma vez** | Backend async + DB + fila + frontend Vite/TS + Docker + CI/CD + observabilidade, organizado em workstreams paralelos. |
| **Dados de stats** | **Data warehouse no Postgres** | O Postgres deixa de ser só "snapshots de análise" e passa a ser a fonte primária de gamelogs da NBA. **10 temporadas, apenas jogadores ativos.** Backfill **híbrido** (dataset Kaggle para o bulk + nba_api/ESPN para o incremental). Atualização por **worker (cron) + lazy-refresh**. A análise lê do banco (ms), não de HTTP. Stats de jogos finalizados são imutáveis → cache perfeito. Reduz dependência de API em tempo real e mitiga o risco de geoblock. Custo: R$ 0 (tudo local/gratuito). |

---

## 4. Arquitetura-Alvo

```
                          ┌──────────────────────┐
  Browser (Vite/React) ──▶│  nginx (frontend)    │── serve SPA + proxy /api
                          └──────────┬───────────┘
                                     ▼
                          ┌──────────────────────┐   só LÊ → resposta <50ms
                          │  FastAPI (api) async  │
                          │ routers/health/metrics│
                          └─────┬───────────┬─────┘
              POST /api/refresh │           │ GET /api/props|player|status|bets
                  (enfileira)   ▼           ▼
                          ┌────────────┐  ┌──────────────┐
                          │   Redis    │◀▶│  ARQ worker  │ roda analyze_day()
                          │cache+broker│  │   + cron     │ a cada X min
                          └────────────┘  └──────┬───────┘
                                ▲                │ httpx.AsyncClient (paralelo + semáforo)
                                │                ▼
                          ┌──────────┐    ESPN APIs / The Odds API / nba_api
                          │PostgreSQL│◀── snapshots, props, linhas, bets
                          │SQLAlchemy│
                          │2.0 async │
                          │+ Alembic │
                          └──────────┘
```

---

## 5. Estrutura de Diretórios (Monorepo Alvo)

```
nba-scout/
├── backend/
│   ├── pyproject.toml            # deps (uv) + ruff/mypy/pytest config (substitui requirements.txt)
│   ├── uv.lock
│   ├── alembic.ini · alembic/    # migrations async
│   ├── Dockerfile · .dockerignore
│   ├── app/
│   │   ├── main.py               # FastAPI app, lifespan (engine/redis/httpx/arq pool), instrumentação
│   │   ├── core/                 # config.py (pydantic-settings), constants.py, teams.py, logging.py, redis.py, sentry.py
│   │   ├── db/                   # base.py, session.py (async), models/ (player, analysis, prop, line, bet)
│   │   ├── schemas/              # Pydantic v2 — PropOut (=contrato atual), PlayerDetailOut, StatusOut, BetCreate/Out
│   │   ├── clients/              # httpx async: base.py (retry), espn.py, odds.py, nba_live.py (executor)
│   │   ├── analytics/            # LÓGICA INTACTA: ev.py, stats_parsing.py, minutes.py, matchup.py
│   │   ├── services/             # analysis.py (analyze_day async), players.py, demo.py, props_repo.py, bets.py
│   │   ├── cache/                # keys.py, repository.py (get/set JSON com TTL Redis)
│   │   ├── routers/              # props.py, players.py, bets.py, health.py
│   │   └── workers/              # settings.py (WorkerSettings + cron), tasks.py (run_daily_analysis)
│   ├── cli/                      # main.py/interactive.py/report.py (Rich) reusando app.services
│   └── tests/                    # unit/ (test_ev ★, test_minutes, test_stats_parsing, test_teams) + integration/ + fixtures/
├── frontend/
│   ├── index.html                # fontes + <div id="root"> (SEM CDNs)
│   ├── src/
│   │   ├── main.tsx · App.tsx     # createRoot + QueryClientProvider + HashRouter
│   │   ├── api/                   # client.ts, queries.ts, keys.ts
│   │   ├── types/api.ts           # Prop, PropsResponse, PlayerDetail, StatusResponse
│   │   ├── lib/                   # format.ts, teams.ts, props.ts (gameKey/applyFilters/...), csv.ts
│   │   ├── hooks/                 # useFavorites.ts, useTweaks.ts, useIsMobile.ts
│   │   ├── components/            # atoms/*, StarButton, tweaks/*
│   │   ├── pages/                 # Dashboard/*, Player/*
│   │   └── styles/global.css      # = styles.css atual
│   ├── vite.config.ts · tsconfig.json · eslint.config.js · .prettierrc · vitest
│   ├── Dockerfile · nginx.conf · .dockerignore · package.json
├── docker/
│   ├── compose.yml               # base: api, worker, scheduler, postgres, redis, frontend
│   ├── compose.override.yml      # dev: hot-reload, bind mounts
│   └── compose.observability.yml # prometheus, grafana, (loki opcional)
├── .github/
│   ├── workflows/                # ci.yml, build-push.yml, deploy.yml (stub), codeql.yml, security-scan.yml
│   ├── dependabot.yml · CODEOWNERS
├── monitoring/                   # prometheus.yml, grafana/
├── scripts/                      # entrypoint.sh, backup-postgres.sh
├── .pre-commit-config.yaml · Makefile · .env.example
└── docs/                         # DEPLOY.md, RUNBOOK.md, adr/, PLANO_ARQUITETURA_PROFISSIONAL.md (este arquivo)
```

### Mapa de Migração (lógica de negócio preservada, só reorganizada)

| Arquivo atual | Destino |
|---|---|
| `config.py` | `app/core/config.py` (Settings) + `constants.py` + `teams.py` |
| `ev.py` | `app/analytics/ev.py` (**verbatim** — não reescrever a matemática) |
| `stats.py` | divide-se: I/O → `clients/espn.py` + `clients/nba_live.py`; parse puro → `analytics/stats_parsing.py`; defesa → `analytics/matchup.py` |
| `odds.py` | `clients/odds.py`; line history → tabela Postgres |
| `scout.py` | `services/analysis.py` (async) + `analytics/minutes.py` (cascata de minutos) |
| `demo.py` | `services/demo.py` (resolve import circular via `core/teams.py`) |
| `api.py` | `app/main.py` + `routers/*` + `schemas/*` (`_format_entry` → schema `PropOut`) |
| `static/*.jsx` | `frontend/src/*` (ver Workstream C) |

---

## 6. Plano de Implementação (4 Workstreams)

### Workstream A — Backend Produção-Grade

**A0. Fundação (zero risco de runtime).** `pyproject.toml` gerenciado por `uv`, com dependências versionadas:
`fastapi>=0.115`, `uvicorn[standard]`, `gunicorn`, `pydantic>=2.9`, `pydantic-settings`, `sqlalchemy>=2.0.36`, `asyncpg`, `alembic`, `redis>=5.2`, `arq>=0.26`, `httpx>=0.28`, `pandas>=2.2`, `nba_api`, `structlog`, `sentry-sdk[fastapi]`, `prometheus-fastapi-instrumentator`. Dev: `pytest`, `pytest-asyncio`, `respx`, `ruff`, `mypy`, `pre-commit`.
Remover `anthropic` (dependência morta) e `python-dotenv` (o pydantic-settings lê `.env` nativamente). Classe `Settings(BaseSettings)` substitui `config.py`. Logging estruturado com `structlog` (JSON em produção).

**A1. Banco de dados — Data Warehouse de Stats + estado da aplicação (paralelo a A0).** Modelos SQLAlchemy 2.0 async. Dividido em dois grupos:

*Grupo 1 — Data warehouse de stats da NBA (fonte primária, substitui as chamadas HTTP em tempo real):*
- `teams` — 30 times, com mapa de abreviações/aliases (de `config.TEAM_NAME_MAP`) e os IDs das fontes (nba_api, ESPN).
- `players` — apenas **jogadores ativos**, com `normalized_name` indexado + **pg_trgm** para fuzzy match; IDs cruzados (nba_api ↔ ESPN), time atual, posição.
- `games` — jogos (data, mandante/visitante, placar, temporada, flag regular/playoff).
- `player_game_logs` — **a tabela-fonte**: 1 linha por jogador-jogo (MIN, PTS, REB, AST, FG3M, BLK, STL, etc.), **10 temporadas, só ativos** (~350k linhas, ~100 MB). Imutável após o jogo. Índice por `(player_id, game_date)`.
- `sync_state` — watermark do backfill/incremental (último `game_date` sincronizado por jogador/temporada) para o sync incremental e o lazy-refresh.

*Grupo 2 — Estado da aplicação:*
- `analysis_snapshots` — 1 linha por execução de `analyze_day` (status, generated_at, contagens, quota, duração).
- `analyzed_props` — substitui o `partial_results.json`; campos derivados **já materializados** (`games_over_line_pct`, `last5_values` em JSONB, etc.).
- `line_snapshots` — substitui o `line_history.json` (upsert com `ON CONFLICT`).
- `bets` — **feature nova**: bet tracker server-side.

**Backfill (one-shot, gratuito):** `services/ingest.py` importa o dataset Kaggle (box scores), filtra pelos jogadores ativos atuais (via roster nba_api/ESPN) e popula `player_game_logs` das últimas 10 temporadas. **Sync incremental:** task ARQ por cron busca só os jogos novos desde o `sync_state`; **lazy-refresh** dispara refresh de um jogador específico em background se seus dados estiverem "velhos" ao ser consultado.

Alembic configurado em modo async; primeira migration autogerada.

**A2. Async + paralelização (maior ganho, maior risco).** Migrar `requests` → `httpx.AsyncClient` (cliente de processo-longo criado no lifespan, com pool de conexões e o mesmo retry/backoff exponencial atual). O I/O fica em `clients/espn.py` (async); o parse permanece **puro/CPU** em `analytics/stats_parsing.py` — essa separação é o que torna tudo testável e paralelizável. O `nba_api` (síncrono, sem versão async) roda via `run_in_executor`.
`analyze_day()` reescrito async em três fases:
- **Fase A** — por jogo, em paralelo: props + rosters + lesões + defesa via `asyncio.gather`.
- **Fase B** — deduplica os `player_id` num `set` e busca os stats de cada jogador **uma vez só**, com semáforo (`Semaphore(8-10)`).
- **Fase C** — o cálculo de EV é CPU-puro e rápido; loop síncrono normal reusando `ev.estimate_true_probability` **intacto**.
**Proteção de quota da Odds API (limite 500):** semáforo dedicado menor (`Semaphore(3)`) só para a Odds + checagem de `odds:quota:remaining` no Redis antes do gather.
Resultado esperado: **40-120s → poucos segundos**.

**A3. Redis como cache.** Substitui os arquivos `.cache/*.json` por chaves com TTL nativo: `espn:player_index` (24h), `espn:injuries:{time}` (1h), `espn:po_hist:{id}:{ano}` (7d), `odds:quota:*`, `espn:player_stats:{id}` (6-12h). **Importante:** só escalares serializáveis vão ao cache — o DataFrame nunca. Builders de chave centralizados com prefixo de versão (`v1:`) para invalidação em massa.

**A4. Fila ARQ + endpoints reescritos.** `workers/tasks.py::run_daily_analysis(ctx)` chama o serviço de análise, grava o snapshot e aquece o Redis. `workers/settings.py` com `cron_jobs=[cron(run_daily_analysis, minute={0,30})]` (calibrar à quota). Endpoints:
- `GET /api/props` → **só lê** o último snapshot e remonta **exatamente** o JSON que o frontend espera (contrato preservado).
- `GET /api/status` (novo) → estado do worker, quota, timestamp.
- `POST /api/refresh` (novo) → enfileira um job (com throttle no Redis).
- `GET /api/player/{name:path}` → mantém o conversor `:path` (nomes com ponto).
- `/api/bets` CRUD (novo) → bet tracker.
No startup, enfileirar uma análise imediata + comunicar estado "aquecendo" via `/api/status` para o frontend não exibir "sem props".

**A5. Testes + qualidade.** pytest + pytest-asyncio. **`test_ev.py` é prioridade máxima** (é a lógica que dá ou perde dinheiro) — escrever **antes** de mover o código, como rede de segurança. `respx` mocka ESPN e Odds; um **teste de regressão de contrato** garante que `/api/props` continua idêntico. Postgres real em container para JSONB/pg_trgm, `fakeredis` para o resto. Meta: 90%+ em `analytics/`, 80%+ global. `ruff` + `mypy`, healthchecks `/health` e `/health/ready`, métricas Prometheus em `/metrics`, Sentry capturando as exceções de `analyze_day` (hoje engolidas em `except: log.warning`).

### Workstream B — Containerização
- **`backend/Dockerfile`** multi-stage (deps com uv → runtime slim, usuário não-root, `HEALTHCHECK` em `/health`, gunicorn + UvicornWorker). **Worker e scheduler reusam a mesma imagem**, trocando só o `command`.
- **`frontend/Dockerfile`** multi-stage (build Vite com node → servido por `nginx:1.27-alpine`). `nginx.conf` com SPA fallback, `proxy_pass` de `/api` para o serviço `api`, gzip e cache headers.
- **`docker/compose.yml`** (base) com `frontend`, `api`, `worker`, `scheduler`, `postgres:16-alpine` (volume), `redis:7-alpine` (volume), healthchecks e `depends_on`. **`compose.override.yml`** (dev) com hot-reload e bind mounts.

### Workstream C — Frontend Vite + TypeScript Incremental
- **C0 — Scaffold:** Vite react-ts, `tsconfig` com `allowJs`. Copiar `styles.css` e fontes; remover os 3 `<script>` CDN. Backend atual continua servindo `static/` em paralelo.
- **C1 — Núcleo de dados:** `data.jsx` → `lib/teams.ts` + `types/api.ts` + `api/client.ts` + `api/queries.ts` com **TanStack Query v5** (`useProps` com `refetchInterval` de 5 min substitui o `RefreshCountdown`; `usePlayer`, `useStatus`, `useRefresh`). `atoms.jsx` → `lib/format.ts` + `components/atoms/*`.
- **C2:** `favorites.jsx` → `useFavorites.ts` (com `useSyncExternalStore`). `tweaks-panel.jsx` → `useTweaks.ts`, guardando o `postMessage` com `if (window.parent !== window)`.
- **C3 — Páginas:** extrair **funções puras primeiro** de `dashboard.jsx` → `lib/props.ts` (gameKey, applyFilters, applySort, computeMetrics) + `lib/csv.ts`; depois as views. `player.jsx` → `pages/Player`. `app.jsx` → `App.tsx` (React Router `HashRouter`, preserva `#player/Nome`).
- **C4 — Tooling + conversão TS:** ESLint flat + Prettier + Vitest (cobrir funções puras primeiro). Tipar as fronteiras da API, converter `.jsx` → `.tsx` arquivo-a-arquivo. `tsc --noEmit` no CI.
- **Cutover:** validada a paridade (Vite `:5173` vs legado `:8000`), remover o mount de `StaticFiles` do backend e a pasta `static/` — commit isolado e reversível.

### Workstream D — CI/CD e Qualidade de Repositório
- **`ci.yml`** (PR + push na main): job de backend (uv sync, ruff, mypy, pytest + coverage com Postgres e Redis como `services:`, matrix Python 3.11/3.12) em paralelo com job de frontend (`npm ci`, eslint, `tsc --noEmit`, vitest, build) → gate `ci-success` usado na branch protection.
- **`build-push.yml`** (push na main + tags `v*`): build das imagens (backend, frontend) com buildx e push para **ghcr.io**, tags por SHA + semver + latest, cache de layers.
- **`deploy.yml`** — **stub documentado**: estrutura com GitHub Environments (staging/production + reviewers) e o passo de migrations, mas com o mecanismo de deploy comentado como template até a plataforma ser escolhida.
- **Segurança (pode começar já):** Dependabot (pip + npm + actions + docker), CodeQL, gitleaks (varre segredos no histórico), trivy (escaneia imagens), branch protection na `main`, CODEOWNERS, pre-commit hooks.
- **Ops:** Makefile (`dev`, `test`, `lint`, `build`, `migrate`, `logs`), `docs/DEPLOY.md` + `RUNBOOK.md`, ADR documentando a escolha do ARQ. Observabilidade (Prometheus + Grafana + Sentry) ativável quando houver deploy.

---

## 7. Ordem de Execução Recomendada

1. **A0 + A1** (fundação backend + DB) ∥ **C0 + C1** (scaffold frontend + dados) ∥ **D-segurança** (não depende de nada).
2. **A5 parcial:** escrever `test_ev.py` **antes** de mover o `ev.py`.
3. **A2 + A3** (async + Redis) — núcleo do ganho de performance.
4. **A4** (ARQ + inversão dos endpoints).
5. **C2 + C3 + C4** (páginas + conversão TS), em paralelo a A2-A4 (frontend usa o backend atual via proxy).
6. **B** (Dockerfiles + compose) quando o backend novo roda.
7. **D-CI/build** (`ci.yml`, `build-push.yml`).
8. **Cutover** (remover o mount de `static/`) — commit isolado.
9. `deploy.yml` real + Terraform + observabilidade — quando a plataforma for decidida.

**Segurança da migração:** o monólito atual e o `static/` permanecem funcionais até o backend novo estar verde. O frontend novo roda em paralelo (`npm run dev` + proxy → `:8000`), permitindo comparação lado a lado antes do cutover.

---

## 8. Riscos e Mitigações

| Risco | Severidade | Mitigação |
|---|---|---|
| `nba_api`/`stats.nba.com` geoblock em servidor cloud | Alta | Suportar `HTTPS_PROXY` no httpx + executor; modo demo como fallback; documentar no DEPLOY |
| Quebra do contrato JSON com o frontend | Alta | Teste de regressão de contrato; schema `PropOut` espelha `_format_entry` campo a campo |
| Quota da Odds API (500) estourar com o cron | Média | Semáforo dedicado para a Odds, checagem de quota antes do gather, intervalo do cron calibrado, throttle no `/api/refresh` |
| DataFrame `pstats["df"]` não-serializável | Média | Materializar os campos derivados no worker; cachear só escalares |
| 3.000 linhas de JSX com globals (`dashboard.jsx` = 1.358) | Média | Refatorar de baixo para cima (ordem dos `<script>`); extrair funções puras primeiro |
| Docker não instalado na máquina de desenvolvimento | Média | Validar Compose/Dockerfiles via CI; instalar Docker Desktop (WSL2) para teste local |
| TweaksPanel acoplado ao host via postMessage | Baixa | Guardar com `if (window.parent !== window)`; `useTweaks` vira estado local + localStorage em produção |
| Mudança de empates/ordem por concorrência | Baixa | Sort estável com chave secundária (nome do jogador) |

---

## 9. Critérios de Verificação

- **Backend async:** tempo de uma análise completa cai de 40-120s para menos de 10s; `pytest --cov` ≥ 80% global e ≥ 90% em `analytics/`; teste de contrato confirma `/api/props` idêntico ao atual.
- **Inversão de fluxo:** duas chamadas seguidas a `/api/props` → a segunda responde em menos de 50ms; `/api/status` reflete o worker; `POST /api/refresh` enfileira e o cron roda a análise periodicamente.
- **Frontend:** `npm run build` passa; `tsc --noEmit` limpo; Vitest verde nas funções puras; paridade visual entre `:5173` (novo) e `:8000` (legado).
- **Docker:** `docker compose up` sobe api + worker + scheduler + postgres + redis + frontend com healthchecks verdes; `/health/ready` retorna 200.
- **CI:** PR dispara o `ci.yml` (lint + type + test em backend e frontend) e fica verde; push na main publica imagens no ghcr.io; gitleaks/trivy/codeql sem achados críticos.
- **Banco de dados:** `alembic upgrade head` cria o schema; o bet tracker persiste em `bets`; `line_snapshots` substitui o `line_history.json`.

---

## 10. Glossário Rápido

- **EV (Expected Value):** quanto, em média, uma aposta rende acima do "justo". Positivo = vantagem matemática.
- **Kelly:** fórmula que sugere quanto do bankroll apostar conforme a convicção (EV + probabilidade).
- **Prop:** aposta sobre a estatística de um jogador (ex.: "LeBron James over 25.5 pontos").
- **ARQ:** biblioteca Python de fila de tarefas assíncrona, usando Redis como broker.
- **Worker / Scheduler:** processo separado que executa tarefas pesadas em segundo plano; o scheduler as dispara em intervalos (cron).
- **Snapshot:** uma execução completa da análise gravada no banco, com todas as props daquele momento.
- **Cutover:** o momento em que o tráfego passa do sistema antigo para o novo.
- **ghcr.io:** GitHub Container Registry, onde as imagens Docker do projeto serão publicadas.

---

## 11. Pré-requisitos para o Deploy (fase futura)

Quando a plataforma de deploy for decidida, serão necessários: uma conta no GitHub com Actions habilitado (já existe), um registry (ghcr.io, grátis), um servidor (VPS ~2 vCPU/4GB, se a opção for VPS), um domínio (para TLS automático) e os secrets de produção (`ODDS_API_KEY`, `POSTGRES_PASSWORD`, `SENTRY_DSN`, chaves SSH, etc.) configurados nos GitHub Environments.

---

*Documento gerado a partir do plano aprovado. Versão correspondente também salva em `C:\Users\Rodrigo lucas\.claude\plans\wise-sparking-mochi.md` e na memória persistente do assistente.*
