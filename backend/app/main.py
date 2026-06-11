"""FastAPI app — entry point do backend."""

from __future__ import annotations

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator

from app.clients.base import close_client, get_client
from app.core.arq import close_arq_pool, get_arq_pool, init_arq_pool
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.redis import close_redis, init_redis
from app.db.session import get_engine
from app.routers import bets, health, players, props

cfg = get_settings()
configure_logging(cfg.log_level, cfg.environment)
log = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("startup: NBA Scout backend iniciando", env=cfg.environment)

    # --- Engine async (conexao lazy; valida em /health/ready) ---
    get_engine()

    # --- httpx AsyncClient de processo-longo ---
    get_client()

    # --- Redis (cache + estado) — falha-suave em dev ---
    try:
        await init_redis(cfg.redis_url)
    except Exception as exc:  # noqa: BLE001
        log.warning("Redis indisponivel no startup", error=str(exc))
        await close_redis()

    # --- Pool ARQ (produtor de jobs) — falha-suave em dev ---
    try:
        await init_arq_pool()
    except Exception as exc:  # noqa: BLE001
        log.warning("ARQ pool indisponivel no startup", error=str(exc))

    # --- Analise inicial opcional (desligada por padrao) ---
    if cfg.analyze_on_startup:
        pool = get_arq_pool()
        if pool is not None:
            try:
                await pool.enqueue_job("run_daily_analysis")
                log.info("startup: analise inicial enfileirada")
            except Exception as exc:  # noqa: BLE001
                log.warning("Falha ao enfileirar analise inicial", error=str(exc))

    yield

    log.info("shutdown: encerrando conexoes")
    await close_arq_pool()
    await close_redis()
    await close_client()
    engine = get_engine()
    await engine.dispose()


app = FastAPI(
    title="NBA Scout API",
    version="1.0.0",
    docs_url="/docs" if cfg.environment != "production" else None,
    redoc_url=None,
    lifespan=lifespan,
)

# Métricas Prometheus
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# Routers
app.include_router(health.router)
app.include_router(props.router)
app.include_router(players.router)
app.include_router(bets.router)
