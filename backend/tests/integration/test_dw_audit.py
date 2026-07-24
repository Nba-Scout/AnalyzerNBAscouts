"""Integração da coleta de auditoria do DW (A2) — Postgres real."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from app.cli import dw_audit
from app.services import ingest

BASE = date(2026, 1, 1)


async def _seed(
    session, name: str, n: int, *, start: int = 0, playoff_from: int | None = None, null_pts_idx: tuple[int, ...] = ()
):
    player = await ingest.upsert_player(session, full_name=name)
    await session.commit()
    records = [
        {
            "game_date": BASE + timedelta(days=start + i),
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
    assert m["date_gaps"] == 0  # dias 0..11 consecutivos

    # O relatório formatado roda sem erro e reflete o volume
    report = dw_audit.format_report(m)
    assert "Linhas totais......: 15" in report


@pytest.mark.asyncio
async def test_collect_audit_stale_window_and_gaps(session, monkeypatch):
    """Prova, contra o Postgres, as subqueries de janela, stale (temporada ativa) e gaps."""
    from app.core.config import Settings

    # Janela pequena p/ disparar violação com poucos jogos.
    monkeypatch.setattr(
        "app.core.config.get_settings", lambda: Settings(_env_file=None, warehouse_max_games_per_player=3)
    )

    await _seed(session, "Recent", 6, start=25)  # último jogo = dia 30 (recente)
    await _seed(session, "Stale", 6, start=0)  # último jogo = dia 5 (> 14d antes do máx.)

    # 'hoje' logo após o último jogo → temporada ativa (gate do stale).
    m = await dw_audit.collect_audit(session, today=BASE + timedelta(days=31))

    assert m["season_active"] is True
    assert m["window_violations"] == 2  # ambos têm 6 > 3
    assert m["stale_players"] == 1  # só "Stale"
    assert m["date_gaps"] == 1  # buraco entre dia 5 e dia 25
    assert m["max_gap_days"] == 20

    # Mesmo cenário, mas 'hoje' bem depois (offseason) → stale suspenso.
    m2 = await dw_audit.collect_audit(session, today=BASE + timedelta(days=200))
    assert m2["season_active"] is False
    assert m2["stale_players"] == 0


@pytest.mark.asyncio
async def test_collect_audit_empty_dw(session):
    m = await dw_audit.collect_audit(session)
    assert m["total_rows"] == 0
    assert m["players"] == 0
    assert m["pct_playoff"] == 0.0
    assert m["date_min"] is None
    # não deve levantar ao formatar um DW vazio
    assert "vazio" in dw_audit.format_report(m)
