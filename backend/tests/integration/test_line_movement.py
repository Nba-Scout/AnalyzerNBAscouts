"""Line movement — upsert durável de LineSnapshot preserva a linha de abertura."""

from __future__ import annotations

from datetime import date

import pytest


@pytest.mark.asyncio
async def test_line_opened_preserved_across_runs(session):
    from sqlalchemy import select
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    from app.db.models.line import LineSnapshot
    from app.workers.tasks import _upsert_line_snapshot

    d = date(2026, 6, 11)
    args = (session, pg_insert, LineSnapshot, d, "Nikola Jokic", "player_points", "over")

    # 1ª análise: abertura = atual
    opened1 = await _upsert_line_snapshot(*args, 26.5)
    await session.commit()
    assert opened1 == 26.5

    # 2ª análise: linha mudou → abertura preservada, current atualizado
    opened2 = await _upsert_line_snapshot(*args, 27.5)
    await session.commit()
    assert opened2 == 26.5

    row = await session.scalar(
        select(LineSnapshot).where(
            LineSnapshot.game_date == d,
            LineSnapshot.player_name == "Nikola Jokic",
            LineSnapshot.market_key == "player_points",
            LineSnapshot.direction == "over",
        )
    )
    assert row.line_opened == 26.5
    assert row.line_current == 27.5
    assert row.movement == 1.0


@pytest.mark.asyncio
async def test_distinct_keys_independent(session):
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    from app.db.models.line import LineSnapshot
    from app.workers.tasks import _upsert_line_snapshot

    d = date(2026, 6, 11)
    over = await _upsert_line_snapshot(
        session, pg_insert, LineSnapshot, d, "LeBron James", "player_points", "over", 25.5
    )
    under = await _upsert_line_snapshot(
        session, pg_insert, LineSnapshot, d, "LeBron James", "player_points", "under", 24.5
    )
    await session.commit()
    assert over == 25.5
    assert under == 24.5  # direção diferente = registro independente
