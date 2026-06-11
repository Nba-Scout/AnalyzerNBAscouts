"""Wrapper async sobre nba_api (biblioteca sincrona) via run_in_executor.

nba_api bloqueia a thread com chamadas HTTP proprias; por isso todas as
chamadas sao executadas no executor padrao (ThreadPoolExecutor) para nao
travar o event-loop.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

log = logging.getLogger(__name__)


def _sync_get_todays_games() -> list[dict]:
    """Executa em thread separada — nao chamar diretamente."""
    from nba_api.live.nba.endpoints import scoreboard  # type: ignore

    try:
        sb = scoreboard.ScoreBoard()
        data = sb.get_dict()
    except Exception as exc:
        log.error("Falha ao buscar jogos de hoje via nba_api: %s", exc)
        return []

    games_raw = data.get("scoreboard", {}).get("games", [])
    out: list[dict] = []
    for g in games_raw:
        try:
            home = g.get("homeTeam", {})
            away = g.get("awayTeam", {})
            out.append(
                {
                    "game_id": g.get("gameId"),
                    "home_team": f"{home.get('teamCity', '')} {home.get('teamName', '')}".strip(),
                    "away_team": f"{away.get('teamCity', '')} {away.get('teamName', '')}".strip(),
                    "home_id": home.get("teamId"),
                    "away_id": away.get("teamId"),
                    "home_tricode": home.get("teamTricode", ""),
                    "away_tricode": away.get("teamTricode", ""),
                    "status": g.get("gameStatusText", ""),
                    "game_time_utc": g.get("gameTimeUTC", ""),
                }
            )
        except Exception as exc:
            log.warning("Entrada de jogo malformada ignorada: %s", exc)

    return out


def _sync_find_team_id_by_name(name: str) -> str | None:
    """Executa em thread separada — nao chamar diretamente."""
    from nba_api.stats.static import teams  # type: ignore

    try:
        all_teams: list[dict[str, Any]] = teams.get_teams()
    except Exception as exc:
        log.error("Falha ao carregar times estaticos nba_api: %s", exc)
        return None

    norm = name.lower().strip()

    # Busca exata por full_name, nickname e abbreviation
    for t in all_teams:
        if t["full_name"].lower() == norm or t["nickname"].lower() == norm or t["abbreviation"].lower() == norm:
            return str(t["id"])

    # Busca parcial (case-insensitive) — retorna o primeiro match
    for t in all_teams:
        full = t["full_name"].lower()
        nick = t["nickname"].lower()
        if norm in full or full in norm or norm in nick:
            return str(t["id"])

    log.info("Time nao encontrado via nba_api: %s", name)
    return None


def _sync_get_active_player_names() -> list[str]:
    """Executa em thread separada — nao chamar diretamente."""
    from nba_api.stats.static import players  # type: ignore

    try:
        active = players.get_active_players()
    except Exception as exc:
        log.error("Falha ao carregar jogadores ativos nba_api: %s", exc)
        return []
    return [p["full_name"] for p in active if p.get("full_name")]


async def get_active_player_names() -> list[str]:
    """Lista de nomes de jogadores ativos via nba_api.stats.static.

    Dados embutidos na biblioteca (sem request HTTP, sem geoblock). Usado pelo
    backfill eager do data warehouse.
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _sync_get_active_player_names)


async def get_todays_games() -> list[dict]:
    """Retorna lista de jogos do dia corrente via nba_api.live.

    Cada item contem: game_id, home_team, away_team, home_id, away_id,
    home_tricode, away_tricode, status, game_time_utc.
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _sync_get_todays_games)


async def find_team_id_by_name(name: str) -> str | None:
    """Busca o ID numerico (str) de um time pelo nome (parcial, case-insensitive).

    Usa nba_api.stats.static.teams — nao faz request HTTP, apenas acessa
    dados embutidos na biblioteca.  Ainda assim executa em executor para
    manter o padrao async consistente.
    """
    if not name:
        return None
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _sync_find_team_id_by_name, name)
