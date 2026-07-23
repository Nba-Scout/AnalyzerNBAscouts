"""Settlement — mapeamento mercado→coluna do DW e decisão win/loss/push."""

from __future__ import annotations

from types import SimpleNamespace

from app.services.settlement import decide, stat_column, stat_from_log


class TestStatColumn:
    def test_odds_api_keys(self):
        assert stat_column("player_points") == "pts"
        assert stat_column("player_threes") == "fg3m"
        assert stat_column("player_points_rebounds_assists") == "pra"
        assert stat_column("player_blocks_steals") == "stocks"

    def test_stat_codes_da_carteira(self):
        # A carteira grava "PTS"-style (form manual e botão da tabela).
        assert stat_column("PTS") == "pts"
        assert stat_column("pra") == "pra"
        assert stat_column("STOCKS") == "stocks"

    def test_alias_3pm(self):
        assert stat_column("3PM") == "fg3m"

    def test_desconhecido(self):
        assert stat_column("player_double_double") is None
        assert stat_column("") is None


class TestStatFromLog:
    def test_le_coluna_do_log(self):
        game_log = SimpleNamespace(pts=31.0, pra=44.0)
        assert stat_from_log(game_log, "player_points") == 31.0
        assert stat_from_log(game_log, "PRA") == 44.0

    def test_none_quando_stat_ausente(self):
        game_log = SimpleNamespace(pts=None)
        assert stat_from_log(game_log, "player_points") is None

    def test_none_quando_mercado_desconhecido(self):
        game_log = SimpleNamespace(pts=31.0)
        assert stat_from_log(game_log, "mercado_inexistente") is None


class TestDecide:
    def test_over(self):
        assert decide(30.0, 26.5, "over") == "win"
        assert decide(20.0, 26.5, "over") == "loss"

    def test_under(self):
        assert decide(20.0, 26.5, "under") == "win"
        assert decide(30.0, 26.5, "under") == "loss"

    def test_direction_case_insensitive(self):
        assert decide(30.0, 26.5, "OVER") == "win"
        assert decide(30.0, 26.5, "UNDER") == "loss"

    def test_push_na_linha_exata(self):
        assert decide(27.0, 27.0, "over") == "push"
        assert decide(27.0, 27.0, "under") == "push"
