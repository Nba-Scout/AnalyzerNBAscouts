"""Line history — série temporal append-only + endpoint /api/line-history."""

from __future__ import annotations

from datetime import date, datetime, timezone

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
                captured_at=datetime(2026, 6, 11, hh, 0, 0, tzinfo=timezone.utc),
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
