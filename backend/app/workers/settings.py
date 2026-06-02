"""Configuração do worker ARQ."""
from __future__ import annotations

from arq.connections import RedisSettings

from app.core.config import get_settings
from app.workers.tasks import run_daily_analysis, sync_player_logs


def get_redis_settings() -> RedisSettings:
    cfg = get_settings()
    url = cfg.arq_redis_url or cfg.redis_url
    return RedisSettings.from_dsn(url)


class WorkerSettings:
    """Lido pelo CLI: `arq app.workers.settings.WorkerSettings`."""

    functions = [run_daily_analysis, sync_player_logs]
    redis_settings = get_redis_settings()

    # Cron: análise a cada 30 min (calibrar conforme quota da Odds API)
    cron_jobs = [
        # cron(run_daily_analysis, minute={0, 30})
        # Descomente após A2/A4 estar completo
    ]

    on_startup = None
    on_shutdown = None
    max_jobs = 4
    job_timeout = 300
