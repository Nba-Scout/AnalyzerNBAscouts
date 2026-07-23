"""Regressão de contrato de GET /api/props — 29 campos (28 do legado + market_key).

Semeia 1 snapshot + 1 prop no Postgres e valida a forma exata da resposta
que o frontend (data.jsx/dashboard.jsx) consome.
"""

from __future__ import annotations

import pytest

# Conjunto exato de chaves de cada prop (contrato do legado api.py::_format_entry)
PROP_KEYS = {
    "player_name",
    "team",
    "game",
    "market",
    "market_key",
    "line",
    "direction",
    "odd",
    "prob_real",
    "ev_pct",
    "kelly_pct",
    "kelly_full_pct",
    "rating",
    "bookmaker",
    "games_over_line_pct",
    "all_odds",
    "team_injuries",
    "dvp_rank",
    "dvp_total",
    "line_movement",
    "line_opened",
    "projected_min",
    "min_boost_pct",
    "last5_values",
    "avg_stat_last10",
    "def_rating_opponent",
    "pace",
    "implied_prob",
    "minutes_avg",
}

TOP_LEVEL_KEYS = {"props", "generated_at", "from_cache", "demo_mode", "quota_remaining", "quota_limit"}


async def _seed(session):
    from app.db.models.analysis import AnalysisSnapshot
    from app.db.models.prop import AnalyzedProp

    snap = AnalysisSnapshot(status="ok", is_demo=False, props_count=1, strong_count=1, games_count=1, quota_used=13)
    session.add(snap)
    await session.flush()

    session.add(
        AnalyzedProp(
            snapshot_id=snap.id,
            player_name="Nikola Jokic",
            team="DEN",
            opponent="LAL",
            market_key="player_points",
            market_label="Pontos",
            line=27.5,
            direction="over",
            odd_decimal=1.91,
            odd_implied_prob=0.5236,
            bookmaker="pinnacle",
            all_odds=[{"bookmaker": "pinnacle", "odd": 1.91}],
            line_opened=26.5,
            true_probability=0.62,
            ev_percent=18.42,
            kelly_fraction=0.05,
            classification="strong",
            avg_stat_last10=28.3,
            games_over_line_pct=0.7,
            last5_values=[{"value": 28.0, "hit": True}],
            def_rating_opponent=113.2,
            pace=99.1,
            minutes_avg=34.6,
            projected_min=35.0,
            min_boost_pct=0.0,
            dvp_rank=5,
            dvp_total=30,
            team_injuries=[],
        )
    )
    await session.commit()


@pytest.mark.asyncio
async def test_props_contract(client, session):
    await _seed(session)

    resp = await client.get("/api/props")
    assert resp.status_code == 200
    body = resp.json()

    assert set(body) >= TOP_LEVEL_KEYS
    assert body["demo_mode"] is False
    assert body["quota_remaining"] == 487  # 500 - 13
    assert len(body["props"]) == 1

    p = body["props"][0]
    assert set(p.keys()) == PROP_KEYS, set(p.keys()).symmetric_difference(PROP_KEYS)

    # Contrato de tipos/normalização
    assert p["player_name"] == "Nikola Jokic"
    assert p["game"] == "vs LAL"
    assert p["direction"] == "OVER"  # maiúsculo
    assert p["rating"] == "STRONG"  # maiúsculo
    assert 0.0 <= p["prob_real"] <= 1.0  # decimal, não percentual
    assert 0.0 <= p["games_over_line_pct"] <= 1.0  # decimal
    assert p["kelly_pct"] == 5.0  # 0.05 * 100
    assert p["kelly_full_pct"] == 20.0  # 0.05 * 100 * 4
    assert p["line_opened"] == 26.5
    assert p["line_movement"] == 1.0  # 27.5 - 26.5
    assert isinstance(p["all_odds"], list)
    assert isinstance(p["last5_values"], list)


@pytest.mark.asyncio
async def test_props_empty_when_no_snapshot(client):
    resp = await client.get("/api/props")
    assert resp.status_code == 200
    body = resp.json()
    assert body["props"] == []
    assert body["quota_limit"] == 500
