"""Leitura do data warehouse — stats de jogadores a partir de player_game_logs.

Fonte primária da análise: em vez de buscar o gamelog de cada jogador na ESPN a
cada run, lemos do Postgres (populado pelo backfill/sync — ver workers/tasks.py).
A ESPN vira fallback só para quem ainda não está no banco (lazy-refresh).

`batch_gamelog_stats` resolve TODOS os jogadores rostered em 2 queries (1 de
Player por espn_id, 1 de PlayerGameLog), evitando N idas ao banco e o uso
concorrente inseguro da AsyncSession dentro de um asyncio.gather.
"""

from __future__ import annotations

import logging
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.stats_parsing import stats_from_rows
from app.db.models.player import Player
from app.db.models.player_game_log import PlayerGameLog

log = logging.getLogger(__name__)

# Mínimo de jogos no DW para considerar "hit"; abaixo disso tratamos como ausente
# e caímos na ESPN (dados mais ricos para quem mal tem histórico no banco).
MIN_DW_GAMES = 3


def _dw_row_to_dict(r: PlayerGameLog) -> dict:
    """Converte uma linha PlayerGameLog no dict de chaves MAIÚSCULAS que o
    stats_from_rows consome (mesmo formato do _parse_game_rows da ESPN).

    Combos (PRA/PR/PA/RA/STOCKS) NÃO são incluídos aqui — o _add_combo_cols os
    recalcula no stats_from_rows (igual ao caminho ESPN).
    """
    return {
        "Date": r.game_date.isoformat() if r.game_date else "",
        "PTS": r.pts,
        "REB": r.reb,
        "AST": r.ast,
        "FG3M": r.fg3m,
        "BLK": r.blk,
        "STL": r.stl,
        "TOV": r.tov,
        "MIN": r.min_played,
        "FGM": r.fgm,
        "FGA": r.fga,
        "FG3A": r.fg3a,
        "FTM": r.ftm,
        "FTA": r.fta,
        "OREB": r.oreb,
        "DREB": r.dreb,
        "PF": r.pf,
        "PLUS_MINUS": r.plus_minus,
        "HomeAway": r.home_away,
        "Opp": r.opponent_abbr,
    }


async def batch_gamelog_stats(
    session: AsyncSession,
    espn_ids: list[str],
    n_games: int = 20,
    min_games: int = MIN_DW_GAMES,
) -> dict[str, dict]:
    """Lê stats do DW para vários jogadores de uma vez (chave = espn_id, str).

    Retorna {espn_id: stats_dict} apenas para jogadores com >= min_games no banco.
    Quem não estiver no mapa é um "miss" → o chamador busca na ESPN + agenda
    backfill (lazy-refresh).
    """
    ids = [str(e) for e in espn_ids if e]
    if not ids:
        return {}

    players = (await session.scalars(select(Player).where(Player.espn_id.in_(ids)))).all()
    if not players:
        return {}
    pid_to_espn = {p.id: str(p.espn_id) for p in players}

    rows = (
        await session.scalars(
            select(PlayerGameLog)
            .where(PlayerGameLog.player_id.in_(pid_to_espn.keys()))
            .order_by(PlayerGameLog.game_date)
        )
    ).all()

    grouped: dict[int, list[PlayerGameLog]] = defaultdict(list)
    for r in rows:
        grouped[r.player_id].append(r)

    out: dict[str, dict] = {}
    for pid, espn_id in pid_to_espn.items():
        plogs = grouped.get(pid, [])
        if len(plogs) < min_games:
            continue
        # Playoffs só contam para a temporada CORRENTE (a mais recente no DW).
        # A janela deslizante de 100 jogos atravessa temporadas; sem esse escopo,
        # playoffs de temporadas passadas marcariam is_playoffs=True DURANTE a
        # temporada regular e dominariam o lookback. O path ESPN usa n_seasons=1
        # (só a temporada corrente), então playoffs antigos nunca entram por lá —
        # aqui os descartamos para manter a paridade.
        current_season = max((r.season for r in plogs if r.season), default=None)
        regular = [_dw_row_to_dict(r) for r in plogs if not r.is_playoff]
        playoff = [_dw_row_to_dict(r) for r in plogs if r.is_playoff and r.season == current_season]
        team_abbr = next((r.team_abbr for r in reversed(plogs) if r.team_abbr), "") or ""
        out[espn_id] = stats_from_rows(regular, playoff, n_games=n_games, team_abbr=team_abbr)

    log.info("warehouse: %d/%d jogadores servidos pelo DW", len(out), len(ids))
    return out
