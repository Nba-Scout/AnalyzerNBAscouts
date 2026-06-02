"""Router de bet tracker."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.bet import Bet
from app.db.session import get_db
from app.schemas.bets import BetCreate, BetOut, BetSettle

router = APIRouter(prefix="/api/bets", tags=["bets"])


@router.get("", response_model=list[BetOut])
async def list_bets(db: AsyncSession = Depends(get_db)) -> list[BetOut]:
    result = await db.execute(select(Bet).order_by(Bet.added_at.desc()))
    return result.scalars().all()  # type: ignore[return-value]


@router.post("", response_model=BetOut, status_code=201)
async def add_bet(payload: BetCreate, db: AsyncSession = Depends(get_db)) -> BetOut:
    bet = Bet(**payload.model_dump())
    db.add(bet)
    await db.commit()
    await db.refresh(bet)
    return bet  # type: ignore[return-value]


@router.patch("/{bet_id}", response_model=BetOut)
async def settle_bet(
    bet_id: int, payload: BetSettle, db: AsyncSession = Depends(get_db)
) -> BetOut:
    bet = await db.get(Bet, bet_id)
    if not bet:
        raise HTTPException(status_code=404, detail="Bet não encontrada")

    bet.result = payload.result
    bet.status = payload.result
    bet.settled_at = datetime.now(timezone.utc)

    if payload.result == "win":
        bet.profit_loss = round(bet.stake * (bet.odd_decimal - 1), 2)
    elif payload.result == "loss":
        bet.profit_loss = -bet.stake
    else:
        bet.profit_loss = 0.0

    await db.commit()
    await db.refresh(bet)
    return bet  # type: ignore[return-value]
