# NBA Scout — Documentação Completa

> **Este arquivo é a fonte da Wiki do GitHub.** Para publicar: acesse o repositório → Wiki → "Create the first page" → cole o conteúdo das seções abaixo. Depois eu posso automatizar as próximas atualizações via git push.

---

# Visão Geral

O **NBA Scout EV Analyzer** é uma ferramenta que identifica apostas com **valor esperado positivo (EV+)** em player props da NBA.

**O que ele faz, em uma frase:** cruza os stats reais de cada jogador (últimos 10 jogos + histórico de playoffs) com as odds ao vivo das casas de apostas e calcula qual aposta tem vantagem matemática sobre a casa.

**Funciona do Brasil, sem VPN.** Os dados vêm da ESPN API pública (sem bloqueio geográfico) e da The Odds API (uma assinatura barata com 500 requests/mês gratuitos).

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
Jogadores com < 28 minutos em média recebem −3% em props de pontos.

**6. Clamp** — probabilidade sempre limitada entre 25% e 85%.

### Valor esperado (EV%)
```
EV% = (prob_real × (odd - 1) - (1 - prob_real)) × 100
```
Se EV% > 0, a aposta tem valor matemático positivo no longo prazo.

### Kelly fracionado
```
kelly = (prob_real × b − (1 − prob_real)) / b    onde b = odd − 1
stake_sugerida = kelly / 4    (conservador)
```

### Classificação

| Rating | Critério |
|---|---|
| `STRONG` | EV ≥ 8% **e** prob real ≥ 60% |
| `VALUE` | EV ≥ 3% |
| `NEUTRAL` | EV entre −1% e 3% |
| `AVOID` | EV < −1% |

---

## Fontes de dados

| Dado | Fonte | Observação |
|---|---|---|
| Jogos do dia | `data.nba.com` (nba_api) | Sem bloqueio geográfico |
| Stats dos jogadores | ESPN API (não oficial) | Sem autenticação, sem geoblock — funciona do Brasil |
| Histórico de playoffs | ESPN API (temporadas anteriores) | Cacheado no Redis por 7 dias |
| Pace e defesa dos times | ESPN API (team statistics) | Cacheado no Redis por 24h |
| Odds / props ao vivo | The Odds API v4 | Requer `ODDS_API_KEY`; 500 req/mês no free tier |

---

## Arquitetura do sistema

### Por que não é só um script?

A versão original funcionava, mas tinha um problema crítico: `GET /api/props` bloqueava **40–120 segundos** enquanto fazia ~100 chamadas HTTP em série. Qualquer usuário que abrisse o site esperava 2 minutos para ver dados.

A nova arquitetura resolve isso com **inversão do fluxo**:

```
ANTES:  Usuário abre o site → análise roda na hora → 40–120s de espera
DEPOIS: Worker roda a análise em background → resultado salvo no banco
        Usuário abre o site → lê resultado pronto → < 50ms
```

### Stack técnica

```
Browser (React/Vite)
    └── nginx
        └── FastAPI (< 50ms — só lê banco)
              │
              └── Redis (cache 120s)
              └── PostgreSQL (resultado da análise)
                        ↑
              ARQ Worker (background)
                └── analyze_day() async
                    └── ESPN APIs / Odds API / nba_api
```

### Componentes principais

| Componente | Tecnologia | Função |
|---|---|---|
| API | FastAPI + uvicorn | Serve endpoints REST; responde < 50ms |
| Worker | ARQ (async task queue) | Roda análise em background; cron 15h UTC |
| Banco | PostgreSQL + SQLAlchemy async | Data warehouse (10 temporadas) + estado |
| Cache | Redis | Cache de resultados (120s) + broker da fila |
| Frontend | Vite + React + TypeScript | Interface web (em migração) |
| CI/CD | GitHub Actions | Lint + testes + build de imagens Docker |

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

# Em outro terminal — frontend com hot-reload
make dev-frontend
# Acesse: http://localhost:5173
```

### Comandos disponíveis

| Comando | O que faz |
|---|---|
| `make dev` | Sobe Postgres + Redis + API + Worker com hot-reload |
| `make dev-frontend` | Inicia Vite dev server em localhost:5173 |
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
| `CRON_ANALYSIS_HOUR` | `15` | Hora UTC do cron diário (15 = 12h Brasília) |

---

## Banco de dados

### Tabelas principais

**`player_game_logs`** — tabela central do data warehouse
Cada linha = 1 jogador × 1 partida. Campos: pts, reb, ast, fg3m, blk, stl, min, box_score (JSONB completo).
Após o Passo 5 (backfill), terá ~350 mil linhas com 10 temporadas de histórico.

**`analysis_snapshots`**
Cada linha = 1 execução do `analyze_day()`. Campos: status, data, contagem de props, quota usada, duração.

**`analyzed_props`**
Cada linha = 1 prop de 1 análise. Campos: jogador, mercado, linha, direção, odd, probabilidade real, EV%, Kelly, rating.

**`bets`** *(nova feature)*
Bet tracker server-side. Campos: prop apostada, stake, resultado (pending/won/lost/push), valor real.

### Fuzzy search por nome

Nomes de jogadores vêm em formatos diferentes de cada API (ex: "LeBron James" vs "L. James"). O sistema usa a extensão `pg_trgm` do PostgreSQL para busca por similaridade de texto, sem precisar de matching exato.

---

## Roadmap

| Passo | Status | Descrição resumida |
|---|---|---|
| 1 — Fundação | ✅ | Monorepo, modelos, Docker, CI/CD, 33 testes |
| 2 — Async | ✅ | httpx async, análise paralela, 94 testes |
| 3 — Infra | ✅ | Lifespan, ARQ, endpoints reais, migration, Docker E2E |
| 4 — Worker completo | 📋 | Inversão de fluxo: análise em background, API lê resultado |
| 5 — Data Warehouse | 📋 | Backfill 10 temporadas + sync incremental diário |
| 6 — Frontend | 📋 | Dashboard e Player pages em React/TypeScript |
| 7 — Deploy | 📋 | VPS ou PaaS, TLS, Sentry, Prometheus/Grafana |

---

## Perguntas frequentes

**Por que ESPN e não a API oficial da NBA?**
A API oficial da NBA (`stats.nba.com`) é bloqueada para IPs fora dos EUA. A ESPN API não-oficial não tem esse bloqueio e funciona do Brasil sem VPN.

**Quanto custa rodar?**
Atualmente: R$ 0. Tudo roda localmente. A única dependência paga é a The Odds API — o free tier (500 req/mês) é suficiente. O deploy futuro em VPS custa ~€5/mês.

**A ferramenta garante lucro?**
Não. EV+ é uma vantagem matemática no longo prazo (muitas apostas). Em apostas individuais, você pode perder mesmo com EV altíssimo. Use o Kelly fracionado para limitar exposição e apostas esportivas com responsabilidade.

**O que é "modo demo"?**
Quando não há jogos da NBA hoje (offseason) ou quando a The Odds API não retorna eventos, o sistema gera dados sintéticos realistas para teste. O modo demo é identificado como `is_demo: true` na resposta.

**Como contribuir?**
1. Fork o repositório
2. Crie uma branch `feat/minha-feature`
3. Abra um PR para `develop` (não para `main` diretamente)
4. CI precisa estar verde para merge
