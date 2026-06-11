# NBA Scout — EV Analyzer

Ferramenta que identifica **apostas com valor esperado positivo (EV+)** em player props da NBA.

Cruza estatísticas reais dos jogadores (ESPN API) com odds ao vivo (The Odds API) para calcular probabilidade real, EV%, Kelly fracionado e classificar cada prop como `STRONG`, `VALUE`, `NEUTRAL` ou `AVOID`. Funciona **do Brasil, sem VPN**.

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

O projeto está em transformação de um script CLI para uma **aplicação web profissional**. Ambas as versões coexistem:

```
NBA Scout
├── Legado (CLI Python)          ← funcional hoje, mantido até Passo 4/6
│   └── python api.py            ← servidor local com frontend estático
│
└── Novo (monorepo backend+frontend)  ← em construção, Passos 1-7
    ├── backend/  FastAPI async + PostgreSQL + Redis + ARQ
    └── frontend/ React + TypeScript + Vite
```

### Por que a reescrita?

| Problema atual | Solução |
|---|---|
| `GET /api/props` bloqueia 40–120s (análise no request) | Worker ARQ faz análise em background; endpoint só lê resultado (< 50ms) |
| Dados em arquivos `.json` locais | PostgreSQL com data warehouse de 10 temporadas |
| Frontend compilado no browser (Babel CDN) | Vite + TypeScript com build real |
| Sem testes, CI, Docker | 94+ testes, GitHub Actions, Docker Compose |

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
│       ├── services/           # analyze_day(), players, demo mode
│       ├── routers/            # /health, /api/props, /api/player, /api/bets
│       └── workers/            # ARQ settings + tasks (run_daily_analysis, sync_player_logs)
│
├── frontend/                   # Vite + React 18 + TypeScript (em migração)
│   ├── vite.config.ts          # Proxy /api → localhost:8000 em dev
│   └── src/
│       ├── main.tsx            # Entry point
│       └── styles/global.css   # CSS do legado migrado
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
├── .env.example                # Template de variáveis de ambiente
│
# Legado (funcional, mantido até Passo 4/6):
├── api.py                      # Servidor Flask/FastAPI legado
├── scout.py                    # Orquestração da análise (síncrona)
├── ev.py                       # Lógica EV original
├── stats.py, odds.py           # Clientes HTTP síncronos
└── static/                     # Frontend React/Babel legado
```

---

## Como rodar

### Opção 1 — Legado (mais simples, funciona hoje)

```bash
git clone https://github.com/Nba-Scout/AnalyzerNBAscouts.git
cd AnalyzerNBAscouts

pip install -r requirements.txt

cp .env.example .env
# Edite .env: ODDS_API_KEY=sua_chave_aqui

python api.py
# Acesse: http://localhost:8000
```

### Opção 2 — Stack completa com Docker (nova arquitetura)

**Pré-requisitos:** Docker Engine, `uv` (`pip install uv`), Node 20+

```bash
git clone https://github.com/Nba-Scout/AnalyzerNBAscouts.git
cd AnalyzerNBAscouts

cp .env.example .env
# Edite .env com: ODDS_API_KEY, POSTGRES_PASSWORD

# Subir Postgres + Redis + API + Worker
make dev

# Em outro terminal — frontend com hot-reload
make dev-frontend
# Acesse: http://localhost:5173
```

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
| 2 — Async | ✅ Concluído | httpx async, `analyze_day()` com asyncio.gather em 3 fases, 94 testes |
| 3 — Infra | ✅ Concluído | Lifespan completo, ARQ pool, endpoints reais, worker cron, migration pg_trgm |
| 4 — Worker | 📋 Pendente | Inversão de fluxo: análise em background, `/api/props` lê resultado (< 50ms) |
| 5 — Data Warehouse | 📋 Pendente | Backfill Kaggle + incremental nba_api; 10 temporadas, ~350k linhas |
| 6 — Frontend | 📋 Pendente | Migração jsx→tsx, TanStack Query, Dashboard e Player pages |
| 7 — Deploy | 📋 Pendente | VPS (Hetzner/DO) ou PaaS (Fly.io), TLS, Sentry, Prometheus/Grafana |

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
cd backend && python -m pytest tests/ -v
# → 94 passed ✅ (33 ev.py + 61 analytics)
```

Cobertura prioritária em `analytics/` (lógica de EV, matchup, minutos, stats parsing).

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
| `CRON_ANALYSIS_HOUR` | `15` | Hora UTC do cron diário |

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
