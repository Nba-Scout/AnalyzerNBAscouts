"""Router de players — lê stats do data warehouse."""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from app.db.session import get_db

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["players"])


@router.get("/player/{name:path}")
async def get_player(name: str, db: AsyncSession = Depends(get_db)) -> dict:
    """Retorna stats detalhadas do jogador via data warehouse.

    TODO (A2/A3): montar pstats a partir de queries em player_game_logs
    e calcular médias/std/hit-rate via SQL (sem DataFrame ou ESPN API).
    Fallback: ESPN API via clients/espn.py async se não houver dados no DW.
    """
    # Stub — responde com estrutura vazia compatível com o frontend
    return {
        "id": 0,
        "name": name,
        "team": "",
        "teamAbbr": "",
        "position": "—",
        "height": "—",
        "age": "—",
        "home_away_splits": {},
        "averages": {"PTS": 0, "REB": 0, "AST": 0, "PRA": 0, "PR": 0, "PA": 0, "FG3M": 0, "STOCKS": 0},
        "spark": [],
        "recent_games": [],
        "playoff_history": {"seasons": [], "games_count": 0, "avg_pts": 0, "avg_reb": 0, "avg_ast": 0},
    }
