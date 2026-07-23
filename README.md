# NBA Scout — EV Analyzer

Plataforma que identifica **apostas com valor esperado positivo (EV+)** em player props da NBA — e mede, com resultados reais, se as recomendações estão ganhando.

Cruza estatísticas reais dos jogadores (data warehouse próprio + ESPN) com odds ao vivo (The Odds API) para calcular probabilidade real, EV%, Kelly fracionado e classificar cada prop como `STRONG`, `VALUE`, `NEUTRAL` ou `AVOID`. Depois **liquida cada recomendação contra o resultado real do jogo**, alimentando o backtest e a carteira automaticamente. Funciona **do Brasil, sem VPN**.

## Funcionalidades

- **Dashboard "Terminal Pro"** — props do dia em 3 variações de layout, filtros por mercado/jogo/time (com as camisas dos times), EV mínimo, busca, favoritos e export Excel. Dark + light.
- **Linha expandida** — tendência dos últimos 5 jogos, line shopping multi-casa, **Line Movement Graph** (movimento intraday da linha), DvP, pace e minutos projetados.
- **Página do jogador** — médias, histórico com splits casa/fora, playoffs destacados e props do dia.
- **Carteira (bet tracker)** — chip com resumo no header, banca e unidade configuráveis, adicionar/remover aposta com 1 clique direto da tabela, **auto-liquidação** contra o resultado real, P&L/ROI/curva de bankroll.
- **Backtesting Panel** — desempenho histórico das props recomendadas (stake flat 1u): hit rate, P&L, ROI e curva acumulada, por rating e janela.
- **Landing page** — porta de entrada de marketing em `/`; o painel vive em `/dashboard`.

---

## O que é "valor esperado" (EV)?

Imagine que uma casa de apostas oferece 2.10 numa prop de pontos do LeBron James. Isso implica que a casa acha que a probabilidade de LeBron bater a linha é de **1/2.10 = 47.6%**.

Se nossa análise — baseada nos últimos 10 jogos do LeBron, histórico de playoffs, defesa do adversário, pace do jogo e minutos esperados — estima a probabilidade real em **62%**, então:

```
EV% = (62% × (2.10 - 1)) - (38% × 1) = +26.6%
```

A aposta tem 26.6% de valor esperado positivo. No longo prazo, apostar em situações assim é matematicamente lucrativo.

---

## Arquitetura

Monorepo profissional: **backend** (FastAPI async) + **frontend** (SPA Vite/React/TS), conectados por API e servidos por nginx. O legado monolítico foi aposentado (cutover concluído).

```
Browser (SPA) ──▶ nginx ──▶ /api ──▶ FastAPI (async, < 50ms)
                                          │ POST /api/refresh (enfileira)
                                          ▼
                                   ARQ Worker (background, crons diários)
                                    ├─ sync_warehouse     (13:00 UTC — game logs → DW)
                                    ├─ settle_results     (14:30 UTC — liquida props + carteira)
                                    └─ run_daily_analysis (15:00 UTC — Odds API + DW)
                                          │
                             PostgreSQL ◀─┘  Redis (cache + broker)
```

**Princípio central:** a análise pesada (40–120s) sai do request-path. O worker ARQ roda `analyze_day()` por cron (ou sob demanda via `POST /api/refresh`), grava o snapshot no Postgres e aquece o Redis. `GET /api/props` apenas lê o último snapshot → **< 50ms**. As stats vêm do **data warehouse próprio** (475+ jogadores ativos, janela de 100 jogos); a ESPN entra só para popular o DW e cobrir ausentes. No dia seguinte, a **liquidação** cruza cada prop e cada aposta pendente com o game log real do jogador — o ciclo fecha: *analisa → registra → liquida → mede*.

| Antes (monólito legado) | Agora |
|---|---|
| `GET /api/props` bloqueava 40–120s | Worker ARQ em background; endpoint lê resultado (< 50ms) |
| Dados em arquivos `.json` locais | PostgreSQL + data warehouse; cache Redis |
| Frontend compilado no browser (Babel CDN) | Vite + TypeScript + Tailwind, build real, design system |
| Sem testes/CI/Docker | 175+ testes, GitHub Actions, Docker Compose |
| Recomendações sem verificação | Liquidação diária contra o resultado real + Backtesting Panel |

---

## Estrutura do repositório

```
nba-scout/
├── backend/                    # FastAPI + SQLAlchemy + ARQ + Redis
│   ├── pyproject.toml          # Dependências via uv (substitui requirements.txt)
│   ├── Dockerfile
│   ├── alembic/                # Migrations de banco async
│   └── app/
│       ├── main.py             # FastAPI app + lifespan (inicia DB/Redis/ARQ)
│       ├── core/               # Configurações, constantes, times, logging, Redis, ARQ
│       ├── analytics/          # ev.py (lógica EV), stats_parsing, matchup, minutes
│       ├── db/                 # Modelos SQLAlchemy + session async
│       ├── schemas/            # Contratos Pydantic v2 para a API
│       ├── cache/              # Chaves Redis + repositório (get/set JSON com TTL)
│       ├── clients/            # Clientes HTTP async: ESPN, Odds API, nba_api
│       ├── services/           # analyze_day(), warehouse, ingest, settlement, demo mode
│       ├── routers/            # /health, /api/props|player|players|bets|backtest|line-history
│       └── workers/            # ARQ: run_daily_analysis, sync_warehouse, settle_results, backfill
│
├── frontend/                   # Vite + React 19 + TypeScript + Tailwind v4
│   ├── vite.config.ts          # Proxy /api → localhost:8000 em dev
│   ├── Dockerfile · nginx.conf # Build estático + serve/proxy em produção
│   └── src/
│       ├── main.tsx · App.tsx  # Entry + HashRouter (Landing / Dashboard / Player / Bets / Backtest)
│       ├── api/                # client + hooks TanStack Query
│       ├── types/api.ts        # Contrato da API
│       ├── lib/                # format, props, bets, xls, colors, teams (puros + testados)
│       ├── hooks/              # useFavorites, useTweaks, useTheme, useIsMobile
│       ├── components/ui/      # Design system tokenizado (Button, Card, Badge…)
│       ├── pages/              # Landing/, Dashboard/ (3 variações), Player/, Bets/, Backtest/
│       └── styles/global.css   # Tokens (Tailwind v4 @theme) + tema dark/light
│
├── docker/
│   ├── compose.yml             # Stack completa: api, worker, postgres, redis, frontend
│   └── compose.override.yml    # Dev: hot-reload, bind mounts, portas expostas
│
├── .github/workflows/          # CI (lint+test+build) + build de imagens para ghcr.io
├── docs/
│   ├── ARCHITECTURE.md         # Documento técnico detalhado da transformação
│   └── AI_CONTEXT.md           # Contexto completo do projeto para mapeamento via IA
│
├── Makefile                    # make dev | test | lint | migrate | build
└── .env.example                # Template de variáveis de ambiente
```

---

## Como rodar

**Pré-requisitos:** Docker Engine, `uv` (`pip install uv`), Node 20+

```bash
git clone https://github.com/Nba-Scout/AnalyzerNBAscouts.git
cd AnalyzerNBAscouts

cp .env.example .env
# Edite .env com: ODDS_API_KEY, POSTGRES_PASSWORD

# Subir Postgres + Redis + API + Worker
make dev

# Popular o data warehouse (primeira vez — ~4 min, todos os jogadores ativos)
make backfill-dev

# Em outro terminal — frontend com hot-reload
make dev-frontend
# Acesse: http://localhost:5173
```

> Sem backend? `python scripts/mock_api.py` sobe um mock completo da API em :8000 para preview da UI.

### Comandos úteis

```bash
make test           # Roda os testes do backend
make lint           # ruff check + format check
make migrate        # alembic upgrade head
make makemigration msg="add_index"  # Nova migration
make build          # Build das imagens Docker
make logs           # docker compose logs -f
```

---

## Obtendo a chave da Odds API

Acesse [the-odds-api.com](https://the-odds-api.com) e crie uma conta gratuita.

O **free tier** dá **500 requests/mês**. Com 5–6 jogos por análise, dá para rodar 1–2 vezes por dia durante a temporada inteira.

---

## Como o EV é calculado

### 1. Probabilidade real do jogador

Estimada combinando 5 fatores:

**a) Frequência histórica** — fração dos últimos 10 jogos em que o jogador bateu a linha para aquele mercado. Em playoffs, jogos de playoff da temporada atual têm prioridade.

**b) Blend com histórico de playoffs** — se há dados de playoffs de temporadas anteriores (≥ 3 jogos):
```
prob_final = prob_atual × 0.65 + prob_histórica_playoffs × 0.35
```

**c) Ajuste por defesa do adversário** (baseado no defensive rating vs média da liga 112):

| Defesa | Ajuste |
|---|---|
| Ruim (def_rating ≥ 116) | +4% |
| Mediana (≥ 112) | +2% |
| Boa (≤ 110) | −3% |
| Elite (≤ 106) | −5% |

**d) Ajuste por pace** — times com ritmo alto (+2–3%) ou baixo (−2%) afetam props de volume.

**e) Ajuste por minutos** — jogadores com < 28 min médios têm −3% em overs de pontos.

**f) Clamp** — probabilidade limitada entre **25%** e **85%** para evitar extremos.

### 2. Probabilidade implícita da casa

```
prob_casa = 1 / odd_decimal
```

A odd embute uma margem de ~5–8% a favor da casa.

### 3. Valor esperado

```
EV% = (prob_real × (odd - 1) - (1 - prob_real)) × 100
```

### 4. Kelly fracionado

```
kelly = (prob_real × b − (1 − prob_real)) / b    onde b = odd − 1
stake_sugerida = kelly / 4    (Kelly fracionado conservador)
```

### Classificação

| Rating | Critério |
|---|---|
| `STRONG` | EV ≥ 8% **e** prob real ≥ 60% |
| `VALUE` | EV ≥ 3% |
| `NEUTRAL` | EV entre −1% e 3% |
| `AVOID` | EV < −1% |

---

## Roadmap de transformação (Passos)

| Passo | Status | Descrição |
|---|---|---|
| 1 — Fundação | ✅ Concluído | Monorepo, FastAPI, 9 modelos SQLAlchemy, Alembic, Docker, CI/CD, 33 testes |
| 2 — Async | ✅ Concluído | httpx async, `analyze_day()` com asyncio.gather em 3 fases |
| 3 — Infra | ✅ Concluído | Lifespan completo, ARQ pool, endpoints reais, worker cron, migration pg_trgm |
| 4 — Paridade da API | ✅ Concluído | `/api/player` híbrido (DW→ESPN), line movement durável, quota real |
| 5 — Data Warehouse | ✅ Concluído | Pipeline source-agnostic (ESPN + Kaggle), tasks de backfill, lazy-refresh |
| 6 — Frontend | ✅ Concluído | Migração jsx→tsx (TanStack Query, HashRouter, Dashboard + Player) + **redesign "Terminal Pro"** (Tailwind v4, design system, dark/light, Framer Motion) |
| 7 — Deploy/CI | ✅ Concluído | Segurança (CodeQL/Trivy/gitleaks), imagens ghcr.io, deploy.yml (VPS via SSH), Sentry + Prometheus/Grafana |
| 8 — DW ativo | ✅ Concluído | População do data warehouse (sync diário + backfill) e leitura DW-first na análise |
| Produto | ✅ Contínuo | Landing, carteira com auto-liquidação e banca/unidade, Line Movement Graph, **Backtesting Panel**, autocomplete de jogador, export Excel |
| 9 — Deploy real | 📋 Planejado | VPS + domínio + secrets nos GitHub Environments |

> Cutover concluído: o monólito legado (`api.py` + `static/`) foi removido — o monorepo `backend/` + `frontend/` é o sistema oficial.

Detalhes técnicos em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Fontes de dados

| Dado | Fonte | Observação |
|---|---|---|
| Jogos do dia | `data.nba.com` (nba_api) | Sem bloqueio geográfico |
| Stats dos jogadores | ESPN API (não oficial) | Sem autenticação, sem geoblock |
| Histórico de playoffs | ESPN API (temporadas anteriores) | Cache Redis 7d |
| Pace e defesa dos times | ESPN API (team statistics) | Cache Redis 24h |
| Odds / props ao vivo | The Odds API v4 | Requer `ODDS_API_KEY` |

---

## Testes

```bash
cd backend && python -m pytest tests/ -v        # ~138 testes (114 unit + 24 integração)
cd frontend && npm test                          # 39 testes Vitest (funções puras)
```

Cobertura prioritária em `analytics/` (EV, matchup, minutos, stats parsing) e nas funções puras do frontend (`lib/`).

---

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `ODDS_API_KEY` | — | **Obrigatória**. Chave da The Odds API |
| `POSTGRES_HOST` | `localhost` | Host do PostgreSQL |
| `POSTGRES_PORT` | `5432` | Porta |
| `POSTGRES_USER` | `nba_scout` | Usuário |
| `POSTGRES_PASSWORD` | — | **Obrigatória** |
| `POSTGRES_DB` | `nba_scout` | Nome do banco |
| `REDIS_URL` | `redis://localhost:6379/0` | URL do Redis |
| `ENVIRONMENT` | `development` | `development` ou `production` |
| `LOG_LEVEL` | `INFO` | Nível de log |
| `ANALYZE_ON_STARTUP` | `false` | Se `true`, dispara análise ao iniciar a API |
| `CRON_ANALYSIS_HOUR` | `15` | Hora UTC do cron de análise |
| `CRON_WAREHOUSE_SYNC_HOUR` | `13` | Hora UTC do sync do data warehouse |
| `CRON_SETTLEMENT_HOUR` | `14` | Hora UTC da liquidação (backtest + carteira, roda em :30) |

---

## Troubleshooting

### Nenhuma prop retornada

Verifique se há jogos da NBA hoje. Em offseason ou dias sem jogos, o sistema ativa o **modo demo** com dados sintéticos para teste.

### `player not found in nba_api: Nome X`

O matching é fuzzy (normaliza unicode, pontuação, sufixos Jr/II/III). Se um jogador específico repetir esse erro, abra uma issue com o nome exato retornado pela Odds API.

### Quota esgotada (< 10 requests)

O sistema para automaticamente. Use `GET /api/props` para ver o último resultado cacheado sem nova chamada.

### `redis: not_initialized` em `/health/ready`

Redis não está rodando. Com Docker: `docker compose up redis`.

---

## Aviso legal

> Apostas envolvem risco financeiro. EV+ é uma métrica estatística que aponta oportunidades favoráveis no longo prazo — **não é garantia de lucro em nenhuma aposta individual**. Use o Kelly fracionado para limitar exposição. Verifique a legalidade de apostas esportivas na sua jurisdição.
