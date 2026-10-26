"""Movimento de linha com linhas alternativas (escada) — rastreia a linha principal."""

from __future__ import annotations

import pytest

PLAYER = "Giannis Antetokounmpo"


def _ladder(main: float) -> list[dict]:
    """Escada da Bovada (1 casa por degrau) + a linha principal ofertada por 4 casas."""
    entries = []
    for i in range(10):
        line = 24.5 + i
        books = 4 if line == main else 1
        entries.append(
            {
                "player_name": PLAYER,
                "market_key": "player_points",
                "direction": "over",
                "line": line,
                "odd_decimal": round(1.36 + 0.19 * i, 2),
                "all_odds": [{"bookmaker": f"b{j}", "odd": 1.9} for j in range(books)],
            }
        )
    return entries


@pytest.mark.asyncio
async def test_ladder_moves_with_main_line(engine, session, monkeypatch):
    from sqlalchemy import func, select
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.db import session as db_session
    from app.db.models.line import LineHistory, LineSnapshot
    from app.db.models.prop import AnalyzedProp
    from app.services import analysis
    from app.workers.tasks import run_daily_analysis

    monkeypatch.setattr(db_session, "get_session_factory", lambda: async_sessionmaker(engine, expire_on_commit=False))
    runs = iter([_ladder(28.5), _ladder(27.5)])

    async def fake_analyze_day(session):
        return next(runs)

    monkeypatch.setattr(analysis, "analyze_day", fake_analyze_day)

    await run_daily_analysis({})
    first = (await session.scalars(select(AnalyzedProp))).all()
    assert {p.line - p.line_opened for p in first} == {0.0}  # abertura: sem movimento

    await run_daily_analysis({})
    last_snapshot = await session.scalar(select(func.max(AnalyzedProp.snapshot_id)))
    second = (await session.scalars(select(AnalyzedProp).where(AnalyzedProp.snapshot_id == last_snapshot))).all()
    # Principal 28.5 → 27.5: todo degrau da escada carrega o mesmo -1.0.
    assert len(second) == 10
    assert {round(p.line - p.line_opened, 1) for p in second} == {-1.0}

    snap = (await session.scalars(select(LineSnapshot))).one()
    assert (snap.line_opened, snap.line_current) == (28.5, 27.5)
    # Um ponto da série por grupo por rodada (não um por degrau).
    hist = (await session.scalars(select(LineHistory).order_by(LineHistory.id))).all()
    assert [h.line for h in hist] == [28.5, 27.5]
