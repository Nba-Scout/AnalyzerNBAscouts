"""Router do Backtesting Panel — ROI histórico das props liquidadas.

Lê analyzed_props já liquidadas pelo worker (settle_results) e agrega por dia:
stake flat de 1 unidade por prop → P&L do dia = Σ (win: odd-1 | loss: -1 |
push: 0) e curva acumulada. Sem chamadas externas; só Postgres.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.analysis import AnalysisSnapshot
from app.db.models.prop import AnalyzedProp
from app.db.session import get_db
from app.schemas.backtest import BacktestDay, BacktestResponse, BacktestSummary

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["backtest"])

_RATINGS = {"strong", "value", "neutral", "avoid"}


@router.get("/backtest", response_model=BacktestResponse)
async def get_backtest(
    rating: str = Query(default="strong", description="strong | value | all"),
    days: int = Query(default=90, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
) -> BacktestResponse:
    """ROI histórico das props (stake flat 1u), agregado por dia de análise."""
    since = datetime.now(UTC) - timedelta(days=days)
    rating_norm = rating.lower()

    stmt = (
        select(
            AnalyzedProp.result,
            AnalyzedProp.odd_decimal,
            AnalysisSnapshot.generated_at,
        )
        .join(AnalysisSnapshot, AnalyzedProp.snapshot_id == AnalysisSnapshot.id)
        .where(AnalysisSnapshot.generated_at >= since)
        .order_by(AnalysisSnapshot.generated_at.asc())
    )
    if rating_norm in _RATINGS:
        stmt = stmt.where(AnalyzedProp.classification == rating_norm)

    rows = (await db.execute(stmt)).all()

    by_day: dict[str, dict[str, float]] = {}
    wins = losses = pushes = voids = pending = 0
    odd_sum = 0.0

    for result, odd, generated_at in rows:
        if result is None:
            pending += 1
            continue
        if result == "void":
            voids += 1
            continue

        day = generated_at.date().isoformat()
        bucket = by_day.setdefault(day, {"props": 0, "wins": 0, "losses": 0, "pushes": 0, "pnl": 0.0})
        bucket["props"] += 1
        odd_sum += odd

        if result == "win":
            wins += 1
            bucket["wins"] += 1
            bucket["pnl"] += odd - 1.0
        elif result == "loss":
            losses += 1
            bucket["losses"] += 1
            bucket["pnl"] -= 1.0
        else:  # push
            pushes += 1
            bucket["pushes"] += 1

    series: list[BacktestDay] = []
    cum = 0.0
    for day in sorted(by_day):
        b = by_day[day]
        cum += b["pnl"]
        series.append(
            BacktestDay(
                date=day,
                props=int(b["props"]),
                wins=int(b["wins"]),
                losses=int(b["losses"]),
                pushes=int(b["pushes"]),
                pnl_units=round(b["pnl"], 2),
                cum_units=round(cum, 2),
            )
        )

    settled = wins + losses + pushes
    decided = wins + losses
    summary = BacktestSummary(
        rating=rating_norm if rating_norm in _RATINGS else "all",
        days=days,
        props=settled,
        wins=wins,
        losses=losses,
        pushes=pushes,
        voids=voids,
        pending=pending,
        hit_rate=round(100 * wins / decided, 1) if decided else 0.0,
        pnl_units=round(cum, 2),
        roi_pct=round(100 * cum / settled, 1) if settled else 0.0,
        avg_odd=round(odd_sum / settled, 2) if settled else 0.0,
    )
    return BacktestResponse(summary=summary, series=series)
