"""Testes do pipeline de ingestão do data warehouse (Passo 5).

Parte pura (parsing CSV/ESPN, sem DB) + parte de integração (upsert idempotente,
dedup cross-source) contra Postgres real. Colhidos só quando asyncpg está
presente (CI + validação local com container).
"""

from __future__ import annotations

from datetime import date

import pytest

from app.services import ingest


# ---------------------------------------------------------------------------
# Helpers de fixture de dados ESPN
# ---------------------------------------------------------------------------
def _stat_row(event_id: str, pts: int, reb: int, ast: int) -> dict:
    arr = ["34.5", "10", "18", "0.5", "2", "5", "0.4", "6", "7", "0.85"]
    arr += [str(reb - 9), "9", str(reb), str(ast), "1", "1", "2", "3", str(pts), "5"]
    return {"eventId": event_id, "stats": arr}


def _espn_single(rows_by_type: dict[str, list[tuple]]) -> dict:
    """rows_by_type: {displayName: [(eid, pts, reb, ast, 'YYYY-MM-DD'), ...]}"""
    events: dict = {}
    season_types: list = []
    for display, rows in rows_by_type.items():
        for eid, _p, _r, _a, dt in rows:
            events[eid] = {"opponent": {"abbreviation": "LAL"}, "gameDate": dt, "atVs": "vs"}
        items = [_stat_row(eid, p, r, a) for eid, p, r, a, _dt in rows]
        season_types.append({"displayName": display, "categories": [{"type": "event", "events": items}]})
    return {"events": events, "seasonTypes": season_types}


# ---------------------------------------------------------------------------
# Parte pura — sem DB
# ---------------------------------------------------------------------------
class TestPureHelpers:
    def test_season_str_from_date(self):
        assert ingest.season_str_from_date(date(2025, 11, 1)) == "2025-26"
        assert ingest.season_str_from_date(date(2026, 4, 1)) == "2025-26"
        assert ingest.season_str_from_date(date(2026, 9, 30)) == "2026-27"

    def test_kaggle_min_parsing(self):
        assert ingest._kaggle_min_to_float("34:12") == pytest.approx(34.2, abs=0.05)
        assert ingest._kaggle_min_to_float("28") == 28.0
        assert ingest._kaggle_min_to_float("") is None
        assert ingest._kaggle_min_to_float(None) is None

    def test_espn_raw_to_records_tags_playoffs_and_skips_bad_dates(self):
        raw = _espn_single(
            {
                "2025-26 Regular Season": [("1", 20, 10, 8, "2026-03-01")],
                "2025-26 Playoffs": [("2", 30, 12, 10, "2026-05-01")],
            }
        )
        recs = ingest.espn_raw_to_records(raw)
        assert len(recs) == 2
        po = [r for r in recs if r["is_playoff"]]
        reg = [r for r in recs if not r["is_playoff"]]
        assert len(po) == 1 and len(reg) == 1
        assert po[0]["pts"] == 30
        assert po[0]["season"] == "2025-26"
        assert reg[0]["game_date"] == date(2026, 3, 1)
        # combos materializados no upsert, não aqui — mas pts/reb/ast presentes
        assert po[0]["reb"] == 12

    def test_parse_kaggle_details(self, tmp_path):
        games = tmp_path / "games.csv"
        games.write_text(
            "GAME_ID,GAME_DATE_EST,SEASON,HOME_TEAM_ID,VISITOR_TEAM_ID\n"
            "0022000001,2021-01-15,2020,1610612747,1610612743\n",
            encoding="utf-8",
        )
        details = tmp_path / "games_details.csv"
        details.write_text(
            "GAME_ID,TEAM_ABBREVIATION,PLAYER_ID,PLAYER_NAME,MIN,FGM,FGA,FG3M,FG3A,"
            "FTM,FTA,OREB,DREB,REB,AST,STL,BLK,TO,PF,PTS,PLUS_MINUS\n"
            "0022000001,LAL,2544,LeBron James,35:10,10,18,2,5,6,7,1,8,9,11,1,1,3,2,28,5\n"
            "0022000001,LAL,99,DNP Guy,,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0\n",
            encoding="utf-8",
        )
        grouped = ingest.parse_kaggle_details(str(details), str(games))
        # DNP (MIN vazio) é ignorado → só LeBron
        assert len(grouped) == 1
        (name, pid), recs = next(iter(grouped.items()))
        assert name == "LeBron James"
        assert pid == 2544
        assert len(recs) == 1
        rec = recs[0]
        assert rec["game_date"] == date(2021, 1, 15)
        assert rec["season"] == "2020-21"
        assert rec["pts"] == 28
        assert rec["min_played"] == pytest.approx(35.2, abs=0.05)
        assert rec["source"] == "kaggle"


# ---------------------------------------------------------------------------
# Integração — Postgres real
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_upsert_player_get_or_create(session):
    p1 = await ingest.upsert_player(session, full_name="Nikola Jokic", espn_id="3112335")
    await session.commit()
    p2 = await ingest.upsert_player(session, full_name="Nikola Jokić", nba_api_id=203999)
    await session.commit()
    # mesmo normalized_name → mesma linha; nba_api_id preenchido depois
    assert p1.id == p2.id
    assert p2.espn_id == "3112335"
    assert p2.nba_api_id == 203999


@pytest.mark.asyncio
async def test_upsert_game_logs_idempotent_and_coalesce(session):
    from sqlalchemy import func, select

    from app.db.models.player_game_log import PlayerGameLog

    player = await ingest.upsert_player(session, full_name="Test Player")
    await session.commit()
    d = date(2026, 1, 10)

    # Kaggle: registro rico (com placar)
    await ingest.upsert_game_logs(
        session,
        player.id,
        [{"game_date": d, "season": "2025-26", "pts": 30, "reb": 10, "ast": 5, "team_score": 112, "source": "kaggle"}],
        source="kaggle",
    )
    await session.commit()

    # ESPN: mesmo (player, data), sem placar → não deve apagar team_score
    await ingest.upsert_game_logs(
        session,
        player.id,
        [{"game_date": d, "season": "2025-26", "pts": 30, "reb": 10, "ast": 5, "team_score": None, "source": "espn"}],
        source="espn",
    )
    await session.commit()

    count = await session.scalar(
        select(func.count()).select_from(PlayerGameLog).where(PlayerGameLog.player_id == player.id)
    )
    assert count == 1  # dedup por (player, data)

    row = await session.scalar(select(PlayerGameLog).where(PlayerGameLog.player_id == player.id))
    assert row.team_score == 112  # COALESCE preservou o dado rico do Kaggle
    assert row.pra == 45  # combo materializado (30+10+5)
    assert row.source == "espn"  # último a escrever


@pytest.mark.asyncio
async def test_ingest_kaggle_only_active(session, tmp_path):
    from sqlalchemy import func, select

    from app.db.models.player_game_log import PlayerGameLog

    games = tmp_path / "games.csv"
    games.write_text("GAME_ID,GAME_DATE_EST,SEASON\n0022000010,2021-02-01,2020\n", encoding="utf-8")
    details = tmp_path / "games_details.csv"
    details.write_text(
        "GAME_ID,TEAM_ABBREVIATION,PLAYER_ID,PLAYER_NAME,MIN,PTS,REB,AST,FG3M,STL,BLK\n"
        "0022000010,DEN,203999,Nikola Jokic,38:00,25,12,9,1,1,1\n"
        "0022000010,RET,1,Retired Player,30:00,10,5,5,0,0,0\n",
        encoding="utf-8",
    )

    # Só "Nikola Jokic" existe na Player (ativo) → o aposentado é ignorado
    await ingest.upsert_player(session, full_name="Nikola Jokic")
    await session.commit()

    result = await ingest.ingest_kaggle(session, str(details), str(games), only_active=True)
    assert result["players"] == 1
    assert result["games"] == 1

    total = await session.scalar(select(func.count()).select_from(PlayerGameLog))
    assert total == 1


@pytest.mark.asyncio
async def test_backfill_player_espn_and_cross_source_merge(session, monkeypatch):
    from sqlalchemy import func, select

    from app.db.models.player_game_log import PlayerGameLog
    from app.db.models.sync_state import SyncState

    raw = _espn_single({"2025-26 Regular Season": [("1", 20, 10, 8, "2026-03-01"), ("2", 28, 11, 9, "2026-03-03")]})
    multi = {"seasons": [{"year": 2026, "data": raw}]}

    async def fake_index():
        return {"nikolajokic": "3112335"}

    async def fake_gamelog(pid, n_seasons=1):
        return multi

    monkeypatch.setattr("app.clients.espn.fetch_player_index", fake_index)
    monkeypatch.setattr("app.clients.espn.fetch_player_gamelog", fake_gamelog)

    res = await ingest.backfill_player_espn(session, full_name="Nikola Jokic", n_seasons=3)
    assert res["status"] == "ok"
    assert res["games"] == 2
    assert res["last_game_date"] == "2026-03-03"

    pid = res["player_id"]
    total = await session.scalar(select(func.count()).select_from(PlayerGameLog).where(PlayerGameLog.player_id == pid))
    assert total == 2

    sstate = await session.scalar(select(SyncState).where(SyncState.player_id == pid))
    assert sstate.source == "espn"
    assert sstate.last_game_date == date(2026, 3, 3)


@pytest.mark.asyncio
async def test_prune_player_game_logs_keeps_newest(session):
    """Janela deslizante: prune mantém só os N gamelogs mais recentes."""
    from datetime import timedelta

    from sqlalchemy import select

    from app.db.models.player_game_log import PlayerGameLog

    player = await ingest.upsert_player(session, full_name="Prune Test")
    await session.commit()

    base = date(2026, 1, 1)
    records = [
        {"game_date": base + timedelta(days=i), "season": "2025-26", "pts": float(i), "reb": 1.0, "ast": 1.0}
        for i in range(10)
    ]
    await ingest.upsert_game_logs(session, player.id, records, source="espn")
    await session.commit()

    deleted = await ingest.prune_player_game_logs(session, player.id, keep=4)
    await session.commit()
    assert deleted == 6

    rows = (
        await session.scalars(
            select(PlayerGameLog).where(PlayerGameLog.player_id == player.id).order_by(PlayerGameLog.game_date)
        )
    ).all()
    assert len(rows) == 4
    assert rows[0].game_date == base + timedelta(days=6)  # mantém os mais recentes
    assert rows[-1].game_date == base + timedelta(days=9)

    # No-op quando keep >= total existente
    assert await ingest.prune_player_game_logs(session, player.id, keep=100) == 0
