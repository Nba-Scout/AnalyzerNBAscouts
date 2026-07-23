# NBA Scout — Documentação Completa

> **Este arquivo é a fonte da Wiki do GitHub.** Para publicar: acesse o repositório → Wiki → cole o conteúdo das seções abaixo (ou automatize via git push para o repo `.wiki`).

---

# Visão Geral

O **NBA Scout** é uma plataforma que identifica apostas com **valor esperado positivo (EV+)** em player props da NBA — e mede, com resultados reais, se as recomendações estão ganhando.

**O que ele faz, em uma frase:** cruza os stats reais de cada jogador (data warehouse próprio + ESPN) com as odds ao vivo das casas, calcula a vantagem matemática de cada prop, registra as recomendações e **liquida tudo contra o resultado real dos jogos** — alimentando o backtest e a carteira automaticamente.

**Funciona do Brasil, sem VPN.** Os dados vêm da ESPN API pública (sem bloqueio geográfico) e da The Odds API (500 requests/mês no free tier).

## Funcionalidades

| Área | O que tem |
|---|---|
| **Landing** (`/`) | Página inicial de marketing com CTA para o painel |
| **Dashboard** (`/dashboard`) | Props do dia em 3 variações (Terminal/Cards/Editorial), filtros por mercado/jogo/time (com jerseys dos times), EV mín., busca, favoritos, export Excel |
| **Linha expandida** | Tendência 5J, line shopping multi-casa, **Line Movement Graph** (série intraday da linha), DvP, pace, minutos projetados |
| **Página do jogador** (`/player/:nome`) | Médias, histórico com splits casa/fora, playoffs destacados, props do dia |
| **Carteira** (`/bets` + chip no header) | Bet tracker com banca/unidade configuráveis, toggle adicionar/remover direto da tabela, dedup de aposta idêntica, **auto-liquidação** contra o resultado real, P&L/ROI/curva de bankroll, export Excel |
| **Backtest** (`/backtest`) | ROI histórico das props recomendadas (stake flat 1u): hit rate, P&L, curva acumulada, tabela por dia, filtros por rating e janela |
| **Tema** | Dark (padrão) + light, design system "Terminal Pro" (Tailwind v4 + tokens, accent âmbar) |

---

## Como o EV é calculado

### Probabilidade real do jogador

A probabilidade de o jogador superar a linha é estimada combinando 5 fatores:

**1. Frequência histórica (base)**
Conta quantas vezes nos últimos 10 jogos o jogador bateu a linha para aquele mercado.
Em playoffs, jogos de playoff da temporada atual têm prioridade sobre temporada regular.

**2. Blend com histórico de playoffs** (se houver ≥ 3 jogos de playoffs de temporadas anteriores)
```
prob_final = prob_atual × 0.65 + prob_histórica_playoffs × 0.35
```

**3. Ajuste por defesa do adversário**

| Defesa do adversário | Ajuste na probabilidade |
|---|---|
| Ruim — def_rating ≥ 116 | +4% |
| Mediana — def_rating ≥ 112 | +2% |
| Boa — def_rating ≤ 110 | −3% |
| Elite — def_rating ≤ 106 | −5% |

**4. Ajuste por pace do jogo**
Times com ritmo alto (pace ≥ 102) aumentam props de volume +2–3%. Ritmo baixo (≤ 96): −2%.

**5. Ajuste por minutos esperados**
Jogadores com < 28 minutos em média recebem −3% em props de pontos. Lesões no elenco geram **cascata de minutos** (projected_min / min_boost).

**6. Clamp** — probabilidade sempre limitada entre 25% e 85%.

### Valor esperado (EV%)
```
EV% = (prob_real × (odd - 1) - (1 - prob_real)) × 100
```
Se EV% > 0, a aposta tem valor matemático positivo no longo prazo.

### Kelly fracionado
```
kelly = (prob_real × b − (1 − prob_real)) / b    onde b = odd − 1
stake_sugerida = kelly / 4    (conservador; UI permite Full, 1/2, 1/4, 1/8)
```

### Classificação

| Rating | Critério |
|---|---|
| `STRONG` | EV ≥ 8% **e** prob real ≥ 60% |
| `VALUE` | EV ≥ 3% |
| `NEUTRAL` | EV entre −1% e 3% |
| `AVOID` | EV < −1% |

---

## Ciclo de vida de uma prop (análise → liquidação → backtest)

```
13:00 UTC  sync_warehouse    → ingere os game logs de ontem no data warehouse
14:30 UTC  settle_results    → liquida props e apostas pendentes contra o DW
15:00 UTC  run_daily_analysis→ analisa os jogos de hoje e grava o snapshot
```

1. **Análise** — o worker calcula EV de cada prop do dia (stats do DW; ESPN só para ausentes) e grava em `analyzed_props`. A cada rodada, um ponto da linha vai para `line_history` (Line Movement Graph).
2. **Liquidação** — no dia seguinte, cada prop é cruzada com o game log real do jogador: `win`/`loss`/`push` (+ `void` se não jogou em 3 dias). As **apostas pendentes da carteira liquidam sozinhas** com a mesma regra.
3. **Backtest** — `GET /api/backtest` agrega as props liquidadas por dia com stake flat de 1u: P&L, curva acumulada, hit rate, ROI.

---

## Fontes de dados

| Dado | Fonte | Observação |
|---|---|---|
| Stats dos jogadores | **Data warehouse próprio** (Postgres) | ~475 jogadores ativos × janela de 100 jogos; sync diário |
| Backfill / jogadores ausentes | ESPN API (não oficial) | Sem autenticação, sem geoblock — funciona do Brasil |
| Jogadores ativos | `data.nba.com` (nba_api) | Enumeração para o backfill |
| Histórico de playoffs | ESPN API (temporadas anteriores) | Cacheado no Redis por 7 dias |
| Pace e defesa dos times | ESPN API (team statistics) | Cacheado no Redis por 24h |
| Odds / props ao vivo | The Odds API v4 | Requer `ODDS_API_KEY`; 500 req/mês no free tier |

---

## Arquitetura do sistema

### Por que não é só um script?

A versão original funcionava, mas `GET /api/props` bloqueava **40–120 segundos** fazendo ~100 chamadas HTTP em série. A arquitetura atual inverte o fluxo:

```
ANTES:  Usuário abre o site → análise roda na hora → 40–120s de espera
DEPOIS: Worker roda a análise em background → resultado salvo no banco
        Usuário abre o site → lê resultado pronto → < 50ms
```

### Stack técnica

```
Browser (React/Vite SPA)
    └── nginx
        └── FastAPI (< 50ms — só lê banco/cache)
              │
              ├── Redis (cache 120s + broker ARQ)
              └── PostgreSQL (data warehouse + snapshots + carteira)
                        ↑
              ARQ Worker (background, crons diários)
                ├── sync_warehouse    → ESPN (game logs)
                ├── settle_results   → liquidação (props + carteira)
                └── run_daily_analysis → Odds API + DW
```

### Componentes principais

| Componente | Tecnologia | Função |
|---|---|---|
| API | FastAPI + uvicorn | Endpoints REST; responde < 50ms |
| Worker | ARQ (async task queue) | Análise, sync do DW, liquidação, backfill |
| Banco | PostgreSQL + SQLAlchemy async | Data warehouse + snapshots + carteira |
| Cache | Redis | Cache de resultados (120s) + broker da fila |
| Frontend | Vite + React 19 + TS + Tailwind v4 | SPA "Terminal Pro" (dark/light) |
| CI/CD | GitHub Actions | Lint + testes + CodeQL/Trivy/gitleaks + imagens ghcr.io |
| Observabilidade | Sentry + Prometheus/Grafana | Erros do worker + métricas p95 |

---

## Endpoints da API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` · `/health/ready` | Liveness / readiness (DB + Redis) |
| GET | `/api/props` | Último snapshot de props (cache-aside Redis, < 50ms) |
| POST | `/api/refresh` | Enfileira análise imediata (throttle 60s) |
| GET | `/api/status` | Status da análise / quota |
| GET | `/api/player/{nome}` | Detalhe do jogador (DW → fallback ESPN) |
| GET | `/api/players?q=` | Autocomplete de jogador (busca no DW) |
| GET | `/api/line-history?player=&market=&direction=` | Série temporal intraday da linha |
| GET | `/api/bets` | Lista apostas da carteira |
| POST | `/api/bets` | Adiciona aposta |
| PATCH | `/api/bets/{id}` | Liquida manualmente (win/loss/push) |
| DELETE | `/api/bets/{id}` | Remove aposta (desfazer) |
| GET | `/api/backtest?rating=&days=` | ROI histórico das props liquidadas |

### Tasks do worker (ARQ)

| Task | Disparo | O que faz |
|---|---|---|
| `run_daily_analysis` | cron 15:00 UTC + `POST /api/refresh` | Analisa os jogos do dia, grava snapshot + line_history |
| `sync_warehouse` | cron 13:00 UTC | Sync incremental do DW (temporada corrente, todos os ativos) |
| `settle_results` | cron 14:30 UTC | Liquida props e apostas pendentes contra o DW |
| `backfill_player` | sob demanda / lazy-refresh | Backfill de 1 jogador (N temporadas) |
| `backfill_all_active` | `make backfill` / CLI | Fan-out de backfill para todos os ativos |

CLI manual: `python -m app.workers.enqueue <task> [args]` (dentro do container).

---

## Como rodar localmente

### Pré-requisitos
- Docker Engine (no WSL Ubuntu se for Windows)
- `uv` — `pip install uv`
- Node 20+

### Setup rápido
```bash
git clone https://github.com/Nba-Scout/AnalyzerNBAscouts.git
cd AnalyzerNBAscouts

# Criar arquivo de configuração
cp .env.example .env
# Editar .env: adicionar ODDS_API_KEY e POSTGRES_PASSWORD

# Subir stack completa (Postgres + Redis + API + Worker)
make dev

# Popular o data warehouse (primeira vez — ~4 min)
make backfill-dev

# Em outro terminal — frontend com hot-reload
make dev-frontend
# Acesse: http://localhost:5173
```

### Preview sem backend (só UI)
```bash
python scripts/mock_api.py     # mock da API completa em :8000 (props, carteira, backtest…)
cd frontend && npm run dev     # :5173
```

### Comandos disponíveis

| Comando | O que faz |
|---|---|
| `make dev` | Sobe Postgres + Redis + API + Worker com hot-reload |
| `make dev-frontend` | Inicia Vite dev server em localhost:5173 |
| `make backfill-dev` | Seed do data warehouse (2 temporadas, todos os ativos) |
| `make test` | Roda todos os testes do backend |
| `make lint` | ruff check + ruff format --check |
| `make migrate` | alembic upgrade head |
| `make makemigration msg="..."` | Cria nova migration |
| `make build` | Build das imagens Docker |
| `make logs` | Acompanha logs do Docker Compose |

### Variáveis de ambiente importantes

| Variável | Padrão | Descrição |
|---|---|---|
| `ODDS_API_KEY` | — | **Obrigatória** — The Odds API |
| `POSTGRES_PASSWORD` | — | **Obrigatória** |
| `ANALYZE_ON_STARTUP` | `false` | Se `true`, dispara análise ao iniciar a API |
| `CRON_ANALYSIS_HOUR` | `15` | Hora UTC do cron de análise (15 = 12h Brasília) |
| `CRON_WAREHOUSE_SYNC_HOUR` | `13` | Hora UTC do sync do data warehouse |
| `CRON_SETTLEMENT_HOUR` | `14` | Hora UTC da liquidação (roda em :30) |
| `WAREHOUSE_MAX_GAMES_PER_PLAYER` | `100` | Janela deslizante do DW por jogador |

---

## Banco de dados

### Tabelas principais

**`player_game_logs`** — tabela central do data warehouse
Cada linha = 1 jogador × 1 partida. Stats tradicionais (pts, reb, ast, fg3m, blk, stl…) + combos materializados (pra, pr, pa, ra, stocks) + contexto (casa/fora, adversário, placar). Imutável após o jogo — cache perfeito. Janela deslizante de 100 jogos/jogador (~475 ativos ≈ 26–35k linhas).

**`players`** — jogadores com `normalized_name` (busca sem acento/pontuação), IDs externos (ESPN/nba_api).

**`analysis_snapshots`** — 1 linha por execução do `analyze_day()`: status, contagens, quota usada, duração.

**`analyzed_props`** — 1 linha por prop analisada: jogador, mercado, linha, direção, odds (+ todas as casas), probabilidade real, EV%, Kelly, rating, contexto (DvP, pace, lesões) **+ liquidação** (`actual_value`, `result` win/loss/push/void, `settled_at`) — a matéria-prima do backtest.

**`line_snapshots`** — linha de abertura/atual do dia por prop (upsert durável; alimenta o delta line_movement).

**`line_history`** — série temporal append-only da linha (1 ponto por prop por rodada) — alimenta o Line Movement Graph.

**`bets`** — carteira (bet tracker): prop apostada, stake, odd, resultado, P&L. Liquidada automaticamente pelo worker (ou manualmente via UI).

**`sync_states`** — estado de sincronização do DW por jogador (lazy-refresh).

### Fuzzy search por nome

Nomes de jogadores vêm em formatos diferentes de cada API (ex: "LeBron James" vs "L. James"). O sistema normaliza unicode/pontuação/sufixos (`normalized_name`) e a extensão `pg_trgm` do PostgreSQL cobre busca por similaridade.

---

## Frontend

### Rotas

| Rota | Página |
|---|---|
| `/` | Landing (marketing, fora do shell do painel) |
| `/dashboard` | Painel principal (3 variações de layout) |
| `/player/:nome` | Detalhe do jogador |
| `/bets` | Carteira completa (gestão) |
| `/backtest` | Backtesting Panel |
| `/styleguide` | Design system navegável (dev) |

### Design system "Terminal Pro"

- **Tailwind v4 CSS-first** (`@theme inline`) com tokens semânticos que trocam por tema: `bg-canvas/surface/raised`, `text-fg/fg-muted/fg-subtle`, `border-border`…
- **Accent âmbar** (#f59e0b) para chrome/ação; **verde/vermelho reservados para sinal** (EV, hit, P&L, W/L).
- Dark (padrão) + light com toggle; `prefers-reduced-motion` respeitado.
- Animações com Framer Motion (`motion`, LazyMotion + `m.*`).
- Fontes: JetBrains Mono (dados) + Inter Tight (labels).
- Primitivos em `src/components/ui/` (Button, Badge, Card, Stat, Pill, Tabs, Tooltip, Skeleton, EmptyState).

### Padrões

- Dados via TanStack Query (`useProps` refetch 5min, `useBets`, `useBacktest`, `useLineHistory`, `usePlayerSearch`).
- Ajustes do usuário (variação, odds, Kelly, banca/unidade, tema) persistem em localStorage (painel ⚙ de tweaks).
- Export **Excel (.xls)** de props e da carteira — abre em colunas em qualquer locale.
- Jerseys de time: regata genérica (SVG) tingida com as cores de marca — sem logos.

---

## Roadmap

| Fase | Status | Descrição resumida |
|---|---|---|
| 1 — Fundação | ✅ | Monorepo, modelos, Docker, CI/CD |
| 2 — Async | ✅ | httpx async, análise paralela em 3 fases |
| 3 — Infra | ✅ | Lifespan, ARQ, endpoints reais, migrations |
| 4 — Paridade da API | ✅ | `/api/player` híbrido, line movement durável |
| 5 — Data Warehouse | ✅ | Pipeline source-agnostic (ESPN + Kaggle) |
| 6 — Frontend | ✅ | Migração React/TS + redesign "Terminal Pro" |
| 7 — Deploy/CI | ✅ | Segurança (CodeQL/Trivy/gitleaks), imagens ghcr.io, deploy.yml, Sentry/Grafana |
| 8 — DW ativo | ✅ | População (sync diário + backfill) e leitura DW-first na análise |
| Produto | ✅ | Landing, carteira (auto-liquidação, banca/unidade), Line Movement Graph, Backtesting Panel, autocomplete, export Excel |
| 9 — Deploy real | 📋 | VPS + domínio + secrets (aguardando infra) |
| Futuro | 📋 | Sugestão de stake em unidades (EV × odd), motor de EV neural, `.xlsx` nativo |

---

## Perguntas frequentes

**Por que ESPN e não a API oficial da NBA?**
A API oficial da NBA (`stats.nba.com`) é bloqueada para IPs fora dos EUA. A ESPN API não-oficial não tem esse bloqueio e funciona do Brasil sem VPN. Hoje a ESPN é usada principalmente para popular o data warehouse — a análise lê do banco.

**Quanto custa rodar?**
Atualmente: R$ 0. Tudo roda localmente. A única dependência externa é a The Odds API — o free tier (500 req/mês) é suficiente para 1–2 análises/dia a temporada inteira. O deploy futuro em VPS custa ~€5/mês.

**A ferramenta garante lucro?**
Não. EV+ é uma vantagem matemática no longo prazo (muitas apostas). Em apostas individuais, você pode perder mesmo com EV altíssimo. Use o Kelly fracionado e a banca em unidades para limitar exposição — e o **Backtest** para acompanhar se as recomendações estão performando de verdade.

**Como a liquidação automática funciona?**
Todo dia o worker cruza as props analisadas (e as apostas pendentes da carteira) com o game log real do jogador no data warehouse. Bateu a linha na direção apostada = win; igual à linha = push; jogador sem jogo em 3 dias = void/anulada.

**O que é "modo demo"?**
Quando não há jogos da NBA hoje (offseason) ou quando a The Odds API não retorna eventos, o sistema gera dados sintéticos realistas para teste. O modo demo é identificado como `demo_mode: true` na resposta.

**Como contribuir?**
1. Fork o repositório
2. Crie uma branch `feat/minha-feature`
3. Abra um PR para `develop` (não para `main` diretamente)
4. CI precisa estar verde para merge
