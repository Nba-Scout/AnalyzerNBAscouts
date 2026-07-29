"""Singleton do pool ARQ — usado pela API para enfileirar jobs no worker.

O worker (processo separado) tem seu proprio ciclo de vida via WorkerSettings;
este pool e apenas o lado *produtor* (a API chama enqueue_job). Inicializado
no lifespan do FastAPI e fechado no shutdown.
"""

from __future__ import annotations

import logging

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from app.core.config import get_settings

log = logging.getLogger(__name__)

_pool: ArqRedis | None = None


def build_redis_settings() -> RedisSettings:
    """RedisSettings com o conn_timeout/retries do config.

    Fonte ÚNICA de RedisSettings para os dois lados do ARQ: o pool **produtor**
    (API/worker enfileiram jobs — ex.: backfill_all_active com centenas de jobs) e
    o **consumidor** (WorkerSettings, via workers/settings.get_redis_settings). O
    default do ARQ (conn_timeout=1s) estourava no fan-out do backfill → crash-loop;
    centralizar garante que ambos os lados usem o timeout folgado.
    """
    cfg = get_settings()
    url = cfg.arq_redis_url or cfg.redis_url
    rs = RedisSettings.from_dsn(url)
    rs.conn_timeout = cfg.redis_conn_timeout
    rs.conn_retries = cfg.redis_conn_retries
    return rs


def get_arq_pool() -> ArqRedis | None:
    """Retorna o pool ARQ ativo ou None se ainda nao inicializado."""
    return _pool


async def init_arq_pool() -> ArqRedis:
    """Cria o pool ARQ (Redis broker) e guarda o singleton.

    Chamado no startup do lifespan FastAPI.
    """
    global _pool
    _pool = await create_pool(build_redis_settings())
    log.info("ARQ pool conectado")
    return _pool


async def close_arq_pool() -> None:
    """Fecha graciosamente o pool ARQ. Chamado no shutdown do lifespan."""
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None
        log.info("ARQ pool desconectado.")
