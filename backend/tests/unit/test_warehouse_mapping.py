"""Teste unitário do mapeamento DW→dict (puro, sem DB)."""

from __future__ import annotations

from datetime import date

from app.db.models.player_game_log import PlayerGameLog
from app.services.warehouse import _dw_row_to_dict


def test_dw_row_to_dict_maps_uppercase_keys():
    row = PlayerGameLog(
        game_date=date(2026, 3, 1),
        pts=20.0,
        reb=10.0,
        ast=5.0,
        fg3m=2.0,
        blk=1.0,
        stl=1.0,
        tov=3.0,
        min_played=34.0,
        home_away="home",
        opponent_abbr="LAL",
    )
    d = _dw_row_to_dict(row)

    assert d["Date"] == "2026-03-01"
    assert d["PTS"] == 20.0
    assert d["REB"] == 10.0
    assert d["AST"] == 5.0
    assert d["MIN"] == 34.0
    assert d["HomeAway"] == "home"
    assert d["Opp"] == "LAL"
    # Combos (PRA/PR/...) NÃO entram aqui — _add_combo_cols recalcula no stats_from_rows
    assert "PRA" not in d
    assert "STOCKS" not in d
