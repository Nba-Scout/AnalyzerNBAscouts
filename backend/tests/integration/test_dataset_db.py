"""Integração do build_training_rows (A4) contra o DW real — Postgres."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from app.analytics.dataset import FEATURE_COLUMNS, build_training_rows
from app.services import ingest

BASE = date(2025, 11, 1)


async def _seed_player_logs(session, *, name: str, n: int) -> int:
    player = await ingest.upsert_player(session, full_name=name)
    await session.commit()
    records = [
        {
            "game_date": BASE + timedelta(days=i),
            "season": "2025-26",
            "season_type": "Regular Season",
            "is_playoff": False,
            "home_away": "home" if i % 2 == 0 else "away",
            "opponent_abbr": "LAL",
            "min_played": 30.0,
            "pts": 20.0 + i,
            "reb": 8.0,
            "ast": 5.0,
        }
        for i in range(n)
    ]
    await ingest.upsert_game_logs(session, player.id, records, source="espn")
    await session.commit()
    return player.id


@pytest.mark.asyncio
async def test_build_training_rows_from_dw(session):
    await _seed_player_logs(session, name="Dataset Player", n=8)

    rows = await build_training_rows(session, markets=["player_points"], min_history=5)

    # 8 jogos, min_history=5 → alvos nos índices 5,6,7 = 3 linhas
    assert len(rows) == 3
    r = rows[0]
    for col in FEATURE_COLUMNS:
        assert col in r and r[col] is not None
    assert r["market"] == "player_points"
    assert r["stat"] == "PTS"
    assert r["line_source"] == "synthetic"  # sem LineSnapshot ainda
    # corte temporal: a linha do jogo em BASE+5 usa média dos pts de 0..4 (=22.0)
    r5 = next(x for x in rows if x["game_date"] == BASE + timedelta(days=5))
    assert r5["avg_5"] == pytest.approx(22.0)


@pytest.mark.asyncio
async def test_real_line_from_line_snapshot(session):
    from app.db.models.line import LineSnapshot

    await _seed_player_logs(session, name="Line Player", n=8)

    target = BASE + timedelta(days=7)
    session.add(
        LineSnapshot(
            game_date=target,
            player_name="Line Player",
            market_key="player_points",
            direction="over",
            line_opened=99.5,
            line_current=99.5,
        )
    )
    await session.commit()

    rows = await build_training_rows(session, markets=["player_points"], min_history=5)
    r = next(x for x in rows if x["game_date"] == target)
    assert r["line_source"] == "real"
    assert r["line"] == pytest.approx(99.5)
    assert r["label"] == 0  # pts do dia 7 (=27) < 99.5
