"""Singleton Redis async — init/close gerenciados pelo lifespan da aplicacao."""
from __future__ import annotations

import logging

from redis.asyncio import Redis, from_url

log = logging.getLogger(__name__)

_redis: Redis | None = None


def get_redis() -> Redis | None:
    """Retorna a instancia Redis ativa ou None se ainda nao inicializada."""
    return _redis


async def init_redis(url: str) -> Redis:
    """Cria a conexao Redis, faz ping de verificacao e guarda o singleton.

    Chamado no startup do lifespan FastAPI.
    """
    global _redis
    _redis = from_url(url, encoding="utf-8", decode_responses=True)
    await _redis.ping()
    log.info("Redis conectado: %s", url)
    return _redis


async def close_redis() -> None:
    """Fecha graciosamente a conexao Redis.

    Chamado no shutdown do lifespan FastAPI.
    """
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None
        log.info("Redis desconectado.")
