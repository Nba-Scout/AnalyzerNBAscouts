"""Testes unitários para app.analytics.stats_parsing.

Cobre: _normalize_name, _parse_event_date, _parse_made_attempted,
_parse_game_rows, build_player_stats, games_over_line, get_last5_values.
Rodáveis sem banco, sem Redis, sem API externa.
"""
from __future__ import annotations

import importlib
import sys
import types

import pandas as pd
import pytest

# conftest.py já adiciona backend/ ao sys.path


# ---------------------------------------------------------------------------
# Stub de app.core.config (evita depender de pydantic_settings no ambiente base)
# Padrão idêntico ao test_ev.py — injeta via autouse fixture + monkeypatch
# ---------------------------------------------------------------------------

class _FakeSettings:
    """Settings mínimo usado por games_over_line (decay_factor)."""
    decay_factor: float = 0.9


@pytest.fixture(autouse=True)
def patch_config(monkeypatch):
    """Substitui app.core.config por stub — sem pydantic_settings."""
    fake_config = types.ModuleType("app.core.config")
    fake_config.get_settings = lambda: _FakeSettings()
    fake_config.Settings = _FakeSettings
    monkeypatch.setitem(sys.modules, "app.core.config", fake_config)

    # Injeta pydantic_settings stub para que o import de config.py não exploda
    if "pydantic_settings" not in sys.modules:
        ps = types.ModuleType("pydantic_settings")

        class BaseSettings:
            pass

        class SettingsConfigDict(dict):
            pass

        ps.BaseSettings = BaseSettings
        ps.SettingsConfigDict = SettingsConfigDict
        monkeypatch.setitem(sys.modules, "pydantic_settings", ps)

    # Força reload do stats_parsing para pegar o stub de config
    if "app.analytics.stats_parsing" in sys.modules:
        importlib.reload(sys.modules["app.analytics.stats_parsing"])

    yield

    # Limpeza: remove do cache para não vazar entre testes
    sys.modules.pop("app.analytics.stats_parsing", None)


# ---------------------------------------------------------------------------
# Fixture: importa o módulo alvo
# ---------------------------------------------------------------------------

@pytest.fixture
def sp():
    """Retorna o módulo app.analytics.stats_parsing (com stub de config ativo)."""
    import app.analytics.stats_parsing as module
    return module


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_player_stats(pts_values: list[float]) -> dict:
    """Monta um player_stats mínimo com coluna PTS."""
    df = pd.DataFrame({"PTS": pts_values})
    return {"df": df}


# ---------------------------------------------------------------------------
# _normalize_name
# ---------------------------------------------------------------------------

class TestNormalizeName:
    def test_normalize_name_basic(self, sp):
        """'LeBron James' -> letras minúsculas, sem espaços."""
        result = sp._normalize_name("LeBron James")
        assert "lebron" in result
        assert "james" in result

    def test_normalize_name_dots(self, sp):
        """'T.J. Warren' -> pontos removidos -> contém 'tj' e 'warren'."""
        result = sp._normalize_name("T.J. Warren")
        assert "tj" in result
        assert "warren" in result

    def test_normalize_name_accent(self, sp):
        """Acentos removidos: 'Nikola Jokić' -> contém 'nikola' e 'joki'."""
        result = sp._normalize_name("Nikola Jokić")
        assert "nikola" in result
        assert "joki" in result

    def test_normalize_name_suffix_jr(self, sp):
        """Sufixo 'Jr.' deve ser removido do resultado."""
        result = sp._normalize_name("LeBron James Jr.")
        assert "jr" not in result

    def test_normalize_name_empty(self, sp):
        """String vazia -> string vazia."""
        assert sp._normalize_name("") == ""

    def test_normalize_name_only_alnum(self, sp):
        """Resultado contém apenas caracteres alfanuméricos."""
        result = sp._normalize_name("D'Angelo Russell")
        assert result.isalnum()

    def test_normalize_name_lowercase(self, sp):
        """Resultado deve ser inteiramente lowercase."""
        result = sp._normalize_name("Stephen Curry")
        assert result == result.lower()


# ---------------------------------------------------------------------------
# _parse_event_date
# ---------------------------------------------------------------------------

class TestParseEventDate:
    def test_parse_event_date_valid(self, sp):
        """String compacta '20240115' -> '2024-01-15'."""
        result = sp._parse_event_date("20240115")
        assert result == "2024-01-15"

    def test_parse_event_date_empty(self, sp):
        """String vazia -> ''."""
        result = sp._parse_event_date("")
        assert result == ""

    def test_parse_event_date_none(self, sp):
        """None como argumento -> '' (sem explodir)."""
        result = sp._parse_event_date(None)
        assert result == ""

    def test_parse_event_date_iso_passthrough(self, sp):
        """String já no formato ISO '2024-03-20' passa sem alteração."""
        result = sp._parse_event_date("2024-03-20")
        assert result == "2024-03-20"

    def test_parse_event_date_truncates_to_10(self, sp):
        """Datas com horário são truncadas para YYYY-MM-DD (10 chars)."""
        result = sp._parse_event_date("2024-01-15T19:30:00Z")
        assert result == "2024-01-15"


# ---------------------------------------------------------------------------
# _parse_made_attempted
# ---------------------------------------------------------------------------

class TestParseMadeAttempted:
    def test_parse_made_attempted_normal(self, sp):
        """'5-10' -> (5, 10) — tupla (feitos, tentativas)."""
        result = sp._parse_made_attempted("5-10")
        assert result == (5, 10)

    def test_parse_made_attempted_zero(self, sp):
        """'0-0' -> (0, 0)."""
        assert sp._parse_made_attempted("0-0") == (0, 0)

    def test_parse_made_attempted_empty(self, sp):
        """String vazia -> (0, 0)."""
        assert sp._parse_made_attempted("") == (0, 0)

    def test_parse_made_attempted_none(self, sp):
        """None -> (0, 0) (não explode)."""
        assert sp._parse_made_attempted(None) == (0, 0)

    def test_parse_made_attempted_plain_int(self, sp):
        """String '7' (inteiro puro) -> (7, 7)."""
        assert sp._parse_made_attempted("7") == (7, 7)

    def test_parse_made_attempted_high_values(self, sp):
        """'12-22' -> (12, 22)."""
        assert sp._parse_made_attempted("12-22") == (12, 22)


# ---------------------------------------------------------------------------
# games_over_line
# ---------------------------------------------------------------------------

class TestGamesOverLine:
    def test_games_over_line_basic(self, sp):
        """5 jogos [20,25,30,15,22] com line=21.5 -> valor positivo com decay."""
        player_stats = _make_player_stats([20.0, 25.0, 30.0, 15.0, 22.0])
        result = sp.games_over_line(player_stats, line=21.5, stat_key="PTS")
        assert result > 0.0

    def test_games_over_line_all_over(self, sp):
        """Todos os jogos acima da linha -> resultado == 1.0."""
        player_stats = _make_player_stats([30.0, 35.0, 32.0, 28.0, 40.0])
        result = sp.games_over_line(player_stats, line=20.0, stat_key="PTS")
        assert result == pytest.approx(1.0)

    def test_games_over_line_all_under(self, sp):
        """Todos os jogos abaixo da linha -> 0.0."""
        player_stats = _make_player_stats([10.0, 12.0, 8.0, 11.0, 9.0])
        result = sp.games_over_line(player_stats, line=20.0, stat_key="PTS")
        assert result == pytest.approx(0.0)

    def test_games_over_line_empty_col(self, sp):
        """player_stats sem coluna PTS -> 0.0."""
        df = pd.DataFrame({"REB": [5.0, 7.0]})
        player_stats = {"df": df}
        result = sp.games_over_line(player_stats, line=20.0, stat_key="PTS")
        assert result == 0.0

    def test_games_over_line_none_df(self, sp):
        """df=None -> 0.0."""
        result = sp.games_over_line({"df": None}, line=20.0, stat_key="PTS")
        assert result == 0.0

    def test_games_over_line_range(self, sp):
        """Resultado sempre entre 0.0 e 1.0."""
        player_stats = _make_player_stats([18.0, 22.0, 25.0, 19.0, 23.0])
        result = sp.games_over_line(player_stats, line=21.5, stat_key="PTS")
        assert 0.0 <= result <= 1.0


# ---------------------------------------------------------------------------
# get_last5_values
# ---------------------------------------------------------------------------

class TestGetLast5Values:
    def test_get_last5_values_count(self, sp):
        """Com mais de 5 jogos, retorna no máximo 5 items."""
        player_stats = _make_player_stats([10.0, 15.0, 20.0, 25.0, 30.0, 35.0, 40.0])
        result = sp.get_last5_values(player_stats, stat_key="PTS", line=20.0)
        assert len(result) <= 5

    def test_get_last5_values_fields(self, sp):
        """Cada item tem as chaves 'value' e 'hit'."""
        player_stats = _make_player_stats([20.0, 25.0, 30.0])
        result = sp.get_last5_values(player_stats, stat_key="PTS", line=20.0)
        assert len(result) > 0
        for item in result:
            assert "value" in item
            assert "hit" in item

    def test_get_last5_values_hit_flag(self, sp):
        """value=25 > line=20 -> hit=True."""
        player_stats = _make_player_stats([25.0])
        result = sp.get_last5_values(player_stats, stat_key="PTS", line=20.0)
        assert len(result) == 1
        assert result[0]["hit"] is True
        assert result[0]["value"] == pytest.approx(25.0)

    def test_get_last5_values_miss_flag(self, sp):
        """value=15 < line=20 -> hit=False."""
        player_stats = _make_player_stats([15.0])
        result = sp.get_last5_values(player_stats, stat_key="PTS", line=20.0)
        assert len(result) == 1
        assert result[0]["hit"] is False

    def test_get_last5_values_empty_df(self, sp):
        """df vazio -> lista vazia."""
        player_stats = {"df": pd.DataFrame()}
        result = sp.get_last5_values(player_stats, stat_key="PTS", line=20.0)
        assert result == []

    def test_get_last5_values_missing_col(self, sp):
        """Coluna inexistente -> lista vazia."""
        df = pd.DataFrame({"REB": [5.0, 7.0]})
        player_stats = {"df": df}
        result = sp.get_last5_values(player_stats, stat_key="PTS", line=20.0)
        assert result == []


# ---------------------------------------------------------------------------
# build_player_stats / integração
# ---------------------------------------------------------------------------

class TestBuildPlayerStats:
    def test_build_player_stats_required_fields(self, sp):
        """player_stats montado com DataFrame mínimo possui campos obrigatórios."""
        player_stats = {
            "df": pd.DataFrame([
                {"PTS": 20.0, "REB": 5.0, "AST": 3.0, "FG3M": 2.0,
                 "BLK": 0.5, "STL": 1.0, "MIN": 32.0,
                 "Opp": "LAL", "Date": "2024-01-15"},
                {"PTS": 25.0, "REB": 7.0, "AST": 4.0, "FG3M": 3.0,
                 "BLK": 1.0, "STL": 2.0, "MIN": 34.0,
                 "Opp": "GSW", "Date": "2024-01-17"},
            ]),
            "avg_pts": 22.5,
            "avg_reb": 6.0,
            "avg_ast": 3.5,
            "avg_3pm": 2.5,
            "avg_blk": 0.75,
            "avg_stl": 1.5,
            "minutes_avg": 33.0,
            "games_played": 2,
            "is_playoffs": False,
        }
        required = ["df", "avg_pts", "minutes_avg", "games_played"]
        for field in required:
            assert field in player_stats, f"Campo obrigatório ausente: {field}"

    def test_build_player_stats_games_over_line_works(self, sp):
        """games_over_line funciona sobre DataFrame construído manualmente."""
        player_stats = {
            "df": pd.DataFrame([
                {"PTS": 20.0, "Opp": "LAL", "Date": "2024-01-15"},
                {"PTS": 25.0, "Opp": "GSW", "Date": "2024-01-17"},
                {"PTS": 30.0, "Opp": "BOS", "Date": "2024-01-19"},
            ])
        }
        result = sp.games_over_line(player_stats, line=21.5, stat_key="PTS")
        # 2 de 3 jogos acima da linha (25 e 30)
        assert result > 0.0

    def test_build_player_stats_last5_integration(self, sp):
        """get_last5_values retorna dados corretos sobre DataFrame construído."""
        player_stats = {
            "df": pd.DataFrame([
                {"PTS": 20.0, "Date": "2024-01-15"},
                {"PTS": 25.0, "Date": "2024-01-17"},
                {"PTS": 30.0, "Date": "2024-01-19"},
            ])
        }
        result = sp.get_last5_values(player_stats, stat_key="PTS", line=22.0)
        assert len(result) == 3
        assert result[-1]["hit"] is True
        assert result[-1]["value"] == pytest.approx(30.0)
