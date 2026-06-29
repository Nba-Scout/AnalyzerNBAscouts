"""Router de players — detalhe híbrido (data warehouse → fallback ESPN)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.player import PlayerDetailOut
from app.services.player_detail import get_player_detail

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["players"])


@router.get("/player/{name:path}", response_model=PlayerDetailOut)
async def get_player(name: str, db: AsyncSession = Depends(get_db)) -> dict:
    """Retorna stats detalhadas do jogador.

    Tenta o data warehouse (player_game_logs) primeiro; se vazio, cai para a
    ESPN API. Cache-aside Redis (TTL 6h). 404 se o jogador não for encontrado.
    """
    detail = await get_player_detail(name, db)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Jogador não encontrado: {name!r}")
    return detail
