"""FastAPI app — entry point do backend."""
from __future__ import annotations

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.routers import bets, health, players, props

cfg = get_settings()
configure_logging(cfg.log_level, cfg.environment)
log = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("startup: NBA Scout backend iniciando", env=cfg.environment)
    # TODO (A2): inicializar engine async, arq pool, httpx client
    yield
    log.info("shutdown: encerrando conexões")


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
