"""Contrato de GET /api/player — fallback ESPN (DW vazio nos testes).

Mocka as funções do cliente ESPN; valida a forma da resposta + 404.
"""

from __future__ import annotations

import pytest

PLAYER_KEYS = {
    "id",
    "name",
    "team",
    "teamAbbr",
    "position",
    "height",
    "age",
    "home_away_splits",
    "averages",
    "spark",
    "recent_games",
    "playoff_history",
}


def _stat_row(event_id: str, pts: int, reb: int, ast: int) -> dict:
    arr = ["34.5", "10", "18", "0.5", "2", "5", "0.4", "6", "7", "0.85"]
    arr += [str(reb - 9), "9", str(reb), str(ast), "1", "1", "2", "3", str(pts), "5"]
    return {"eventId": event_id, "stats": arr}


def _single_gamelog(display: str, rows: list[tuple]) -> dict:
    """rows: lista de (event_id, pts, reb, ast, date) — datas distintas p/ ordem determinística."""
    events = {eid: {"opponent": {"abbreviation": "LAL"}, "gameDate": dt, "atVs": "vs"} for eid, _, _, _, dt in rows}
    items = [_stat_row(eid, pts, reb, ast) for eid, pts, reb, ast, _ in rows]
    return {
        "events": events,
        "seasonTypes": [{"displayName": display, "categories": [{"type": "event", "events": items}]}],
    }


@pytest.mark.asyncio
async def test_player_contract_espn_fallback(client, monkeypatch):
    # Jogo mais antigo: 20 pts; mais recente: 30 pts → spark (oldest-first) = [20, 30]
    sample = _single_gamelog(
        "2025-26 Playoffs",
        [("1", 20, 10, 8, "2026-05-01"), ("2", 30, 12, 10, "2026-05-03")],
    )
    multi = {"player_id": "3112335", "seasons": [{"year": 2026, "data": sample}]}

    async def fake_index() -> dict:
        return {"nikolajokic": "3112335"}

    async def fake_gamelog(player_id, n_seasons=1):
        return multi

    monkeypatch.setattr("app.clients.espn.fetch_player_index", fake_index)
    monkeypatch.setattr("app.clients.espn.fetch_player_gamelog", fake_gamelog)

    resp = await client.get("/api/player/Nikola Jokic")
    assert resp.status_code == 200
    body = resp.json()

    assert set(body.keys()) == PLAYER_KEYS, set(body.keys()).symmetric_difference(PLAYER_KEYS)
    assert body["name"] == "Nikola Jokic"
    assert set(body["averages"].keys()) == {"PTS", "REB", "AST", "PRA", "PR", "PA", "FG3M", "STOCKS"}
    assert body["averages"]["PTS"] == pytest.approx(25.0)
    assert len(body["recent_games"]) == 2
    assert body["playoff_history"]["games_count"] == 2
    # spark é oldest-first (lista de pontos)
    assert body["spark"] == [20, 30]


@pytest.mark.asyncio
async def test_player_not_found_returns_404(client, monkeypatch):
    async def empty_index() -> dict:
        return {}

    monkeypatch.setattr("app.clients.espn.fetch_player_index", empty_index)

    resp = await client.get("/api/player/Jogador Inexistente")
    assert resp.status_code == 404
