"""Integração da coleta de auditoria do DW (A2) — Postgres real."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from app.cli import dw_audit
from app.services import ingest

BASE = date(2026, 1, 1)


async def _seed(session, name: str, n: int, *, playoff_from: int | None = None, null_pts_idx: tuple[int, ...] = ()):
    player = await ingest.upsert_player(session, full_name=name)
    await session.commit()
    records = [
        {
            "game_date": BASE + timedelta(days=i),
            "season": "2025-26",
            "season_type": "Playoffs" if (playoff_from is not None and i >= playoff_from) else "Regular Season",
            "is_playoff": playoff_from is not None and i >= playoff_from,
            "min_played": 30.0,
            "pts": None if i in null_pts_idx else 20.0,
            "reb": 8.0,
            "ast": 5.0,
        }
        for i in range(n)
    ]
    await ingest.upsert_game_logs(session, player.id, records, source="espn")
    await session.commit()
    return player


@pytest.mark.asyncio
async def test_collect_audit_metrics(session):
    await _seed(session, "Audit A", 12, playoff_from=10, null_pts_idx=(0,))  # 2 playoff, 1 null pts
    await _seed(session, "Audit B", 3)  # jogador raso (<10 jogos)

    m = await dw_audit.collect_audit(session)

    assert m["total_rows"] == 15
    assert m["players"] == 2
    assert m["per_season"] == {"2025-26": 15}
    assert m["players_lt_10_games"] == 1  # só o B
    assert m["duplicates"] == 0
    assert m["window_violations"] == 0  # janela 100 > 12
    assert m["nulls"]["pts"] == 1
    assert m["pct_playoff"] == pytest.approx(13.3, abs=0.3)  # 2/15

    # O relatório formatado roda sem erro e reflete o volume
    report = dw_audit.format_report(m)
    assert "Linhas totais......: 15" in report


@pytest.mark.asyncio
async def test_collect_audit_empty_dw(session):
    m = await dw_audit.collect_audit(session)
    assert m["total_rows"] == 0
    assert m["players"] == 0
    assert m["pct_playoff"] == 0.0
    assert m["date_min"] is None
    # não deve levantar ao formatar um DW vazio
    assert "vazio" in dw_audit.format_report(m)
