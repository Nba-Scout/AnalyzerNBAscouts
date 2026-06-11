"""Servico de jogadores — acesso cache-first a stats e roster via ESPN.

Cache Redis com TTL 6h: armazena JSON cru da ESPN para evitar requisicoes
repetidas. Se Redis nao estiver disponivel (get_redis() retorna None), opera
em modo passthrough (sem cache) sem lancar excecoes.
"""

from __future__ import annotations

import logging

from app.cache import keys as cache_keys
from app.cache.repository import get_json, set_json
from app.core.redis import get_redis

log = logging.getLogger(__name__)

_TTL_6H = 6 * 60 * 60  # 21 600 segundos


async def get_player_stats(player_id: str, n_games: int = 20) -> dict | None:
    """Retorna stats processadas do jogador, usando cache Redis 6h.

    Fluxo:
      1. Redis disponivel + cache hit  → json.loads(raw) ja e o dict de stats
         construido por build_player_stats (armazenamos o resultado final)
      2. Redis disponivel + cache miss → fetch ESPN + build_player_stats +
         set_json no Redis + retorna stats
      3. Redis indisponivel            → fetch ESPN + build_player_stats (sem cache)

    Retorna None se o jogador nao for encontrado ou a ESPN retornar erro.
    """
    from app.analytics.stats_parsing import build_player_stats
    from app.clients.espn import fetch_player_gamelog

    redis = get_redis()
    key = cache_keys.player_stats(player_id)

    # --- Cache hit ---
    if redis is not None:
        try:
            cached = await get_json(redis, key)
            if cached is not None:
                # O cache armazena o dict de stats completo (sem o DataFrame,
                # pois DataFrames nao sao JSON-serializaveis; build_player_stats
                # reconstroi o df a partir dos dados brutos quando necessario).
                # Para manter compatibilidade, retornamos o dict diretamente.
                return cached
        except Exception as exc:
            log.warning("Redis get_json falhou para %s: %s", key, exc)

    # --- Cache miss / Redis indisponivel: busca ESPN ---
    try:
        raw = await fetch_player_gamelog(player_id, n_games=n_games)
    except Exception as exc:
        log.warning("fetch_player_gamelog falhou para player_id=%s: %s", player_id, exc)
        return None

    if not raw:
        return None

    try:
        stats = build_player_stats(raw, n_games)
    except Exception as exc:
        log.warning("build_player_stats falhou para player_id=%s: %s", player_id, exc)
        return None

    # --- Persiste no Redis (apenas campos JSON-serializaveis) ---
    if redis is not None and stats:
        try:
            # Exclui o DataFrame (nao serializavel) antes de cachear
            cacheable = {k: v for k, v in stats.items() if k != "df"}
            await set_json(redis, key, cacheable, _TTL_6H)
        except Exception as exc:
            log.warning("Redis set_json falhou para %s: %s", key, exc)

    return stats


async def get_team_roster(team_abbr: str) -> dict:
    """Retorna o roster do time, usando cache Redis 6h.

    Retorna dict {player_id: player_name} ou {} em caso de falha.
    """
    from app.clients.espn import fetch_team_roster

    redis = get_redis()
    key = cache_keys.team_roster(team_abbr)

    # --- Cache hit ---
    if redis is not None:
        try:
            cached = await get_json(redis, key)
            if cached is not None:
                return cached
        except Exception as exc:
            log.warning("Redis get_json falhou para %s: %s", key, exc)

    # --- Cache miss / Redis indisponivel ---
    try:
        roster = await fetch_team_roster(team_abbr)
    except Exception as exc:
        log.warning("fetch_team_roster falhou para %s: %s", team_abbr, exc)
        return {}

    roster = roster or {}

    # --- Persiste no Redis ---
    if redis is not None and roster:
        try:
            await set_json(redis, key, roster, _TTL_6H)
        except Exception as exc:
            log.warning("Redis set_json falhou para %s: %s", key, exc)

    return roster
