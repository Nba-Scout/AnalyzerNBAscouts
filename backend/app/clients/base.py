"""Cliente HTTP async compartilhado (httpx) com retry/backoff e suporte a proxy.

Unifica a lógica de `_espn_get` (stats.py) e `_request_with_retry` (odds.py)
do código legado síncrono, agora em async sobre um único httpx.AsyncClient
de processo-longo.
"""
from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from typing import Any

import httpx

from app.core.config import get_settings

log = logging.getLogger(__name__)

# Headers usados pela ESPN (espelha o legado stats.py).
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}

_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    """Retorna o AsyncClient singleton (criado lazy). Fechado no lifespan."""
    global _client
    if _client is None or _client.is_closed:
        cfg = get_settings()
        proxy = cfg.https_proxy or cfg.http_proxy or None
        _client = httpx.AsyncClient(
            headers=DEFAULT_HEADERS,
            timeout=httpx.Timeout(20.0),
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            proxy=proxy or None,
            follow_redirects=True,
        )
    return _client


async def close_client() -> None:
    """Fecha o AsyncClient — chamado no shutdown do lifespan."""
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
    _client = None


async def request_json(
    url: str,
    *,
    params: dict | None = None,
    headers: dict | None = None,
    retries: int = 3,
    base_delay: float = 1.5,
    no_retry_statuses: tuple[int, ...] = (),
    on_response: Callable[[httpx.Response], None] | None = None,
) -> Any | None:
    """GET com retry/backoff exponencial. Retorna o JSON ou None.

    - 200 → retorna json()
    - status em `no_retry_statuses` → loga e retorna None (sem retry)
    - 429 ou >= 500 → backoff exponencial e tenta de novo
    - outros 4xx → loga e retorna None
    - `on_response` é chamado em toda resposta (ex: capturar headers de quota)
    """
    delay = base_delay
    client = get_client()

    for attempt in range(retries):
        try:
            r = await client.get(url, params=params, headers=headers)
            if on_response is not None:
                try:
                    on_response(r)
                except Exception:  # noqa: BLE001 — callback não pode derrubar a request
                    pass

            if r.status_code == 200:
                return r.json()

            if r.status_code in no_retry_statuses:
                log.warning("HTTP %s (sem retry) para %s", r.status_code, url)
                return None

            if r.status_code == 429:
                log.warning("HTTP 429 (rate limit), backoff %.1fs — %s", delay, url)
                await asyncio.sleep(delay)
                delay *= 2
                continue

            if r.status_code >= 500:
                log.warning("HTTP %s (server error), retry — %s", r.status_code, url)
                await asyncio.sleep(delay)
                delay *= 2
                continue

            log.warning("HTTP %s para %s", r.status_code, url)
            return None

        except Exception as e:  # noqa: BLE001 — qualquer erro de rede → retry
            log.warning("request falhou (tentativa %d): %s", attempt + 1, e)
            await asyncio.sleep(delay)
            delay *= 2

    return None
