"""Helpers de get/set JSON no Redis com TTL."""

from __future__ import annotations

import json
from typing import Any

from redis.asyncio import Redis


async def get_json(redis: Redis, key: str) -> Any | None:
    raw = await redis.get(key)
    if raw is None:
        return None
    return json.loads(raw)


async def set_json(redis: Redis, key: str, value: Any, ttl_seconds: int) -> None:
    await redis.set(key, json.dumps(value, ensure_ascii=False), ex=ttl_seconds)


async def delete(redis: Redis, key: str) -> None:
    await redis.delete(key)


async def exists(redis: Redis, key: str) -> bool:
    return bool(await redis.exists(key))
