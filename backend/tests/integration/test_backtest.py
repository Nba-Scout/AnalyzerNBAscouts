"""Backtesting — liquidação de props/apostas contra o DW + /api/backtest."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest


async def _seed(session):
    """Jogador com game log ONTEM (pts=30) + snapshot de ontem com 4 props."""
    from app.db.models.analysis import AnalysisSnapshot
    from app.db.models.bet import Bet
    from app.db.models.prop import AnalyzedProp
    from app.services import ingest

    yesterday = datetime.now(UTC) - timedelta(days=1)

    player = await ingest.upsert_player(session, full_name="Backtest Alpha", espn_id="4000001")
    await session.commit()
    await ingest.upsert_game_logs(
        session,
        player.id,
        [
            {
                "game_date": yesterday.date(),
                "season": "2025-26",
                "season_type": "Regular Season",
                "is_playoff": False,
                "min_played": 34.0,
                "pts": 30.0,
                "reb": 10.0,
                "ast": 8.0,
            }
        ],
        source="espn",
    )

    snap = AnalysisSnapshot(status="ok", is_demo=False, generated_at=yesterday)
    session.add(snap)
    await session.flush()

    def prop(player_name: str, line: float, direction: str) -> AnalyzedProp:
        return AnalyzedProp(
            snapshot_id=snap.id,
            player_name=player_name,
            market_key="player_points",
            line=line,
            direction=direction,
            odd_decimal=1.91,
            true_probability=0.6,
            ev_percent=10.0,
            classification="strong",
        )

    session.add(prop("Backtest Alpha", 26.5, "over"))  # 30 > 26.5 → win
    session.add(prop("Backtest Alpha", 26.5, "under"))  # → loss
    session.add(prop("Backtest Alpha", 30.0, "over"))  # 30 == 30 → push
    session.add(prop("Ghost Player", 20.5, "over"))  # sem game log → aguarda

    # Aposta pendente da carteira (market "PTS"-style, como o form grava)
    session.add(
        Bet(
            player_name="Backtest Alpha",
            market_key="PTS",
            line=25.5,
            direction="OVER",
            odd_decimal=1.9,
            stake=100.0,
            added_at=yesterday,
        )
    )
    await session.commit()


@pytest.mark.asyncio
async def test_settle_props_and_bets_from_dw(session):
    from sqlalchemy import select

    from app.db.models.bet import Bet
    from app.db.models.prop import AnalyzedProp
    from app.services import settlement

    await _seed(session)

    props_out = await settlement.settle_analyzed_props(session)
    assert props_out == {"settled": 3, "void": 0, "waiting": 1}

    results = {
        (p.line, p.direction): (p.result, p.actual_value)
        for p in (await session.execute(select(AnalyzedProp))).scalars()
        if p.player_name == "Backtest Alpha"
    }
    assert results[(26.5, "over")] == ("win", 30.0)
    assert results[(26.5, "under")] == ("loss", 30.0)
    assert results[(30.0, "over")] == ("push", 30.0)

    bets_out = await settlement.settle_pending_bets(session)
    assert bets_out == {"settled": 1, "waiting": 0}
    bet = (await session.execute(select(Bet))).scalars().one()
    assert bet.result == "win"
    assert bet.profit_loss == 90.0  # 100 × (1.9 − 1)
    assert bet.settled_at is not None


@pytest.mark.asyncio
async def test_backtest_endpoint_aggregates(client, session):
    from app.services import settlement

    await _seed(session)
    await settlement.settle_analyzed_props(session)

    resp = await client.get("/api/backtest", params={"rating": "strong", "days": 30})
    assert resp.status_code == 200
    body = resp.json()

    s = body["summary"]
    assert s["props"] == 3
    assert s["wins"] == 1 and s["losses"] == 1 and s["pushes"] == 1
    assert s["pending"] == 1  # Ghost Player aguardando
    assert s["hit_rate"] == 50.0
    assert s["pnl_units"] == round(0.91 - 1.0, 2)  # win(odd 1.91) + loss

    assert len(body["series"]) == 1
    day = body["series"][0]
    assert day["props"] == 3
    assert day["cum_units"] == s["pnl_units"]


@pytest.mark.asyncio
async def test_backtest_empty(client):
    resp = await client.get("/api/backtest")
    assert resp.status_code == 200
    body = resp.json()
    assert body["summary"]["props"] == 0
    assert body["series"] == []
