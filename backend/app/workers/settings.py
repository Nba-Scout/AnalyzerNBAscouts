"""Configuração do worker ARQ."""

from __future__ import annotations

import logging

from arq import cron
from arq.connections import RedisSettings

from app.clients.base import close_client, get_client
from app.core.config import get_settings
from app.core.redis import close_redis, init_redis
from app.db.session import get_engine
from app.workers.tasks import run_daily_analysis, sync_player_logs

log = logging.getLogger(__name__)


def get_redis_settings() -> RedisSettings:
    cfg = get_settings()
    url = cfg.arq_redis_url or cfg.redis_url
    return RedisSettings.from_dsn(url)


async def on_startup(ctx: dict) -> None:
    """Inicializa recursos compartilhados no processo do worker."""
    cfg = get_settings()
    get_engine()  # engine async (conexao lazy)
    get_client()  # httpx AsyncClient de processo-longo
    try:
        await init_redis(cfg.redis_url)
    except Exception as exc:  # noqa: BLE001
        log.warning("Worker: Redis indisponivel no startup: %s", exc)
    log.info("Worker ARQ iniciado.")


async def on_shutdown(ctx: dict) -> None:
    """Fecha recursos no shutdown do worker."""
    await close_redis()
    await close_client()
    engine = get_engine()
    await engine.dispose()
    log.info("Worker ARQ encerrado.")


_cfg = get_settings()


class WorkerSettings:
    """Lido pelo CLI: `arq app.workers.settings.WorkerSettings`."""

    functions = [run_daily_analysis, sync_player_logs]
    redis_settings = get_redis_settings()

    # Cron: análise 1x/dia (calibrar conforme quota da Odds API — 500 req/mês).
    # Para mais frequência: cron(run_daily_analysis, hour={15, 21}, minute=0)
    cron_jobs = [
        cron(run_daily_analysis, hour=_cfg.cron_analysis_hour, minute=0),
    ]

    on_startup = on_startup
    on_shutdown = on_shutdown
    max_jobs = 4
    job_timeout = 300
