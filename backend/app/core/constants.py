"""Constantes de domínio que não dependem de env vars."""

from __future__ import annotations

MARKET_LABELS: dict[str, str] = {
    "player_points": "Pontos",
    "player_rebounds": "Rebotes",
    "player_assists": "Assistências",
    "player_threes": "3 Pontos",
    "player_blocks": "Bloqueios",
    "player_steals": "Roubos",
    "player_points_rebounds_assists": "PRA",
    "player_points_rebounds": "Pts+Reb",
    "player_points_assists": "Pts+Ast",
    "player_rebounds_assists": "Reb+Ast",
    "player_blocks_steals": "Blk+Stl",
}

MARKET_TO_STAT: dict[str, str] = {
    "player_points": "PTS",
    "player_rebounds": "REB",
    "player_assists": "AST",
    "player_threes": "FG3M",
    "player_blocks": "BLK",
    "player_steals": "STL",
    "player_points_rebounds_assists": "PRA",
    "player_points_rebounds": "PR",
    "player_points_assists": "PA",
    "player_rebounds_assists": "RA",
    "player_blocks_steals": "STOCKS",
}

# Colunas do data warehouse mapeadas por mercado
STAT_COL: dict[str, str] = MARKET_TO_STAT  # alias semântico

NBA_TOTAL_PLAYER_MIN: float = 240.0  # 5 jogadores × 48 min por time
