"""Line history — série temporal append-only + endpoint /api/line-history."""

from __future__ import annotations

from datetime import UTC, date, datetime

import pytest


async def _seed(session, d, points):
    """Insere pontos (line, hora) para Jokic/player_points/over no dia d."""
    from app.db.models.line import LineHistory

    for line, hh in points:
        session.add(
            LineHistory(
                game_date=d,
                player_name="Nikola Jokic",
                market_key="player_points",
                direction="over",
                line=line,
                odd_decimal=1.9,
                captured_at=datetime(2026, 6, 11, hh, 0, 0, tzinfo=UTC),
            )
        )
    await session.commit()


@pytest.mark.asyncio
async def test_line_history_endpoint_returns_ordered_series(client, session):
    d = date(2026, 6, 11)
    # inseridos fora de ordem → endpoint deve devolver ordenado por captured_at
    await _seed(session, d, [(26.5, 12), (27.5, 15), (27.0, 9)])

    resp = await client.get(
        "/api/line-history",
        params={"player": "Nikola Jokic", "market": "player_points", "direction": "over"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["player_name"] == "Nikola Jokic"
    lines = [p["line"] for p in body["points"]]
    assert lines == [27.0, 26.5, 27.5]  # 09h, 12h, 15h
    assert body["points"][0]["odd"] == 1.9


@pytest.mark.asyncio
async def test_line_history_empty_when_no_data(client):
    resp = await client.get(
        "/api/line-history",
        params={"player": "Fantasma Inexistente", "market": "player_points", "direction": "over"},
    )
    assert resp.status_code == 200
    assert resp.json()["points"] == []


# --- Poda de retenção (C2) -------------------------------------------------


async def _count(session) -> int:
    from sqlalchemy import func, select

    from app.db.models.line import LineHistory

    return (await session.scalar(select(func.count()).select_from(LineHistory))) or 0


@pytest.mark.asyncio
async def test_prune_deletes_only_outside_retention(session):
    """Apaga o que está fora da janela e preserva o que está dentro (inclusive a borda)."""
    from app.services.line_history import prune_line_history

    today = date(2026, 6, 30)
    await _seed(session, today, [(27.0, 9)])  # hoje
    await _seed(session, date(2026, 6, 1), [(25.0, 9), (25.5, 12)])  # 29 dias — dentro
    await _seed(session, date(2026, 5, 31), [(24.0, 9)])  # 30 dias — na borda do corte
    await _seed(session, date(2026, 5, 20), [(23.0, 9), (23.5, 12)])  # 41 dias — fora

    assert await _count(session) == 6
    deleted = await prune_line_history(session, 30, today=today)
    await session.commit()

    assert deleted == 2  # só os dois de 2026-05-20
    assert await _count(session) == 4
    # O corte é game_date < today - 30d, então a borda exata (30 dias) sobrevive.
    from sqlalchemy import select

    from app.db.models.line import LineHistory

    remaining = sorted({d for d in (await session.scalars(select(LineHistory.game_date))).all()})
    assert remaining == [date(2026, 5, 31), date(2026, 6, 1), date(2026, 6, 30)]


@pytest.mark.asyncio
async def test_prune_is_noop_when_retention_disabled(session):
    """retention_days <= 0 desliga a poda — nada é apagado."""
    from app.services.line_history import prune_line_history

    await _seed(session, date(2020, 1, 1), [(20.0, 9)])  # bem antigo
    assert await _count(session) == 1

    assert await prune_line_history(session, 0, today=date(2026, 6, 30)) == 0
    assert await prune_line_history(session, -5, today=date(2026, 6, 30)) == 0
    assert await _count(session) == 1


@pytest.mark.asyncio
async def test_prune_returns_zero_when_nothing_to_delete(session):
    """Idempotente: rodar duas vezes não apaga nada na segunda."""
    from app.services.line_history import prune_line_history

    today = date(2026, 6, 30)
    await _seed(session, date(2026, 1, 1), [(21.0, 9)])

    assert await prune_line_history(session, 30, today=today) == 1
    await session.commit()
    assert await prune_line_history(session, 30, today=today) == 0
