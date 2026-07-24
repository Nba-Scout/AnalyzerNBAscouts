"""Testes puros da formatação do relatório de auditoria do DW (A2) — sem DB."""

from __future__ import annotations

from app.cli import dw_audit


def _metrics(**over) -> dict:
    base = {
        "total_rows": 26500,
        "players": 474,
        "per_season": {"2025-26": 26500},
        "players_lt_10_games": 0,
        "window_violations": 0,
        "window_max": 100,
        "duplicates": 0,
        "pct_playoff": 4.2,
        "nulls": {"min_played": 0, "pts": 0, "reb": 0, "ast": 0},
        "date_min": "2025-10-22",
        "date_max": "2026-04-10",
        "stale_players": 0,
        "stale_days": 14,
    }
    base.update(over)
    return base


def test_format_report_clean_has_no_warnings():
    out = dw_audit.format_report(_metrics())
    assert "Auditoria do Data Warehouse" in out
    assert "26500" in out
    assert "2025-26: 26500" in out
    assert "Alertas: nenhum." in out


def test_format_report_flags_duplicates_and_window():
    out = dw_audit.format_report(_metrics(duplicates=2, window_violations=1))
    assert "2 duplicata" in out
    assert "prune da janela não aplicado" in out
    assert "Alertas: nenhum." not in out


def test_format_report_flags_sparse_and_stale():
    out = dw_audit.format_report(_metrics(players_lt_10_games=3, stale_players=5))
    assert "< 10 jogos" in out
    assert "sem jogo nos últimos 14 dias" in out
