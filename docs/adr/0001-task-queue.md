# ADR 0001 — Fila de tarefas: ARQ

- **Status:** aceito
- **Data:** 2026-06-28
- **Contexto do Passo:** decidido no Passo 1–3; documentado aqui no Passo 7.

## Contexto

A análise diária (`analyze_day` / `run_daily_analysis`) faz dezenas de chamadas HTTP
async (Odds API, ESPN, nba_api) e grava no Postgres. Precisa rodar **fora** do request
da API (para `POST /api/refresh` responder rápido) e **agendada** (cron diário, calibrado
pela quota de 500 req/mês da Odds API). Requisitos:

- Stack já é **async** (FastAPI + httpx + SQLAlchemy async + redis-py async).
- Broker já presente: **Redis** (cache + estado).
- Necessário **cron** embutido (análise 1×/dia).
- Time pequeno → preferir mínimo de peças móveis.

## Decisão

Usar **[ARQ](https://arq-docs.helpmanual.io/)** como fila de tarefas.

- Async-native (roda no mesmo modelo de event loop do resto do backend) — sem ponte
  sync/async como exigiria Celery.
- Usa o **Redis que já temos** como broker; nenhuma dependência nova de infra.
- **Cron embutido** (`cron_jobs` em `WorkerSettings`) → o worker já é o scheduler;
  **sem** container `beat`/`scheduler` separado (ver [IMAGES.md](../IMAGES.md)).
- Mesma imagem do backend; o worker só troca o `command` para
  `arq app.workers.settings.WorkerSettings`.

## Alternativas consideradas

| Opção | Por que não |
|---|---|
| **Celery** | Pesado; integração async ainda imatura; exigiria worker + beat separados e mais config. |
| **RQ** | Síncrono no core; não casa com o pipeline async; sem cron nativo (precisa rq-scheduler). |
| **APScheduler in-process** | Roda dentro da API → acopla agendamento ao ciclo de vida do web server; não escala para múltiplas réplicas. |
| **Cron do SO + script** | Perde retries/estado/observabilidade; duplica setup de ambiente. |

## Consequências

- ➕ Uma peça a menos (sem scheduler dedicado); paridade de deps web/worker.
- ➕ Jobs async de 1ª classe, com `job_timeout`/`max_jobs` configuráveis.
- ➖ Ecossistema menor que Celery (menos plugins/monitoring prontos) — mitigado por
  métricas Prometheus e Sentry no worker (Passo 7.4).
- ➖ Sem painel de filas pronto; status é exposto via `/api/status` + logs.
