"""Configuração do worker ARQ."""

from __future__ import annotations

import logging

from arq import cron
from arq.connections import RedisSettings

from app.clients.base import close_client, get_client
from app.core.arq import close_arq_pool, init_arq_pool
from app.core.config import get_settings
from app.core.observability import init_sentry
from app.core.redis import close_redis, init_redis
from app.db.session import get_engine
from app.workers.tasks import (
    backfill_all_active,
    backfill_player,
    run_daily_analysis,
    settle_results,
    sync_warehouse,
)

log = logging.getLogger(__name__)


def get_redis_settings() -> RedisSettings:
    cfg = get_settings()
    url = cfg.arq_redis_url or cfg.redis_url
    return RedisSettings.from_dsn(url)


async def on_startup(ctx: dict) -> None:
    """Inicializa recursos compartilhados no processo do worker."""
    cfg = get_settings()
    init_sentry()  # ativa o Sentry no worker (falhas de analyze_day reportadas em tasks.py)
    get_engine()  # engine async (conexao lazy)
    get_client()  # httpx AsyncClient de processo-longo
    try:
        await init_redis(cfg.redis_url)
    except Exception as exc:  # noqa: BLE001
        log.warning("Worker: Redis indisponivel no startup: %s", exc)
    # Pool ARQ (produtor) — necessario p/ o worker ENFILEIRAR jobs:
    # backfill_all_active e o lazy-refresh do analyze_day usam get_arq_pool().
    try:
        await init_arq_pool()
    except Exception as exc:  # noqa: BLE001
        log.warning("Worker: pool ARQ indisponivel no startup: %s", exc)
    log.info("Worker ARQ iniciado.")


async def on_shutdown(ctx: dict) -> None:
    """Fecha recursos no shutdown do worker."""
    await close_arq_pool()
    await close_redis()
    await close_client()
    engine = get_engine()
    await engine.dispose()
    log.info("Worker ARQ encerrado.")


_cfg = get_settings()


class WorkerSettings:
    """Lido pelo CLI: `arq app.workers.settings.WorkerSettings`."""

    functions = [run_daily_analysis, backfill_player, backfill_all_active, sync_warehouse, settle_results]
    redis_settings = get_redis_settings()

    # Cron: sync incremental do DW ANTES da análise; liquidação (backtest +
    # carteira) DEPOIS do sync (precisa dos game logs de ontem no DW); análise
    # 1x/dia (calibrar conforme quota da Odds API — 500 req/mês).
    # Para mais frequência: cron(run_daily_analysis, hour={15, 21}, minute=0)
    cron_jobs = [
        cron(sync_warehouse, hour=_cfg.cron_warehouse_sync_hour, minute=0),
        cron(settle_results, hour=_cfg.cron_settlement_hour, minute=30),
        cron(run_daily_analysis, hour=_cfg.cron_analysis_hour, minute=0),
    ]

    on_startup = on_startup
    on_shutdown = on_shutdown
    max_jobs = 4
    job_timeout = 300
