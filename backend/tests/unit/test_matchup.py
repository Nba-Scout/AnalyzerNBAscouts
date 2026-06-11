"""Testes unitários para app.analytics.matchup.

Cobre: compute_matchup, get_dvp_rank.
Rodáveis sem banco, sem Redis, sem API externa.

Interface esperada dos módulos:
    compute_matchup(team_name: str | None, team_stats: dict | None) -> dict
        Retorna dict com chaves: def_rating, pace, dvp_rank, dvp_total

    get_dvp_rank(team_name: str, all_team_stats: dict[str, dict]) -> tuple[int, int]
        Retorna (rank, total) onde rank 1 = pior defesa (melhor para atacante)
"""
from __future__ import annotations

import pytest

# conftest.py já adiciona backend/ ao sys.path


# ---------------------------------------------------------------------------
# Fixture: importa o módulo (criado em paralelo no Passo 2)
# ---------------------------------------------------------------------------

@pytest.fixture
def matchup():
    """Retorna o módulo app.analytics.matchup."""
    import app.analytics.matchup as module
    return module


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_team_stats(def_rating: float = 112.0, pace: float = 100.0,
                     opp_pts: float = 112.0) -> dict:
    return {
        "def_rating": def_rating,
        "pace": pace,
        "opp_pts_per_game": opp_pts,
    }


# ---------------------------------------------------------------------------
# compute_matchup — sem dados (team_name=None / team_stats=None)
# ---------------------------------------------------------------------------

class TestComputeMatchupNone:
    def test_compute_matchup_none_has_all_keys(self, matchup):
        """Chamada com None retorna dict com todas as chaves obrigatórias."""
        result = matchup.compute_matchup(None, None)
        for key in ("def_rating", "pace", "dvp_rank", "dvp_total"):
            assert key in result, f"Chave ausente: {key}"

    def test_compute_matchup_none_defaults(self, matchup):
        """Defaults: def_rating=112.0, pace=100.0, dvp_rank=15."""
        result = matchup.compute_matchup(None, None)
        assert result["def_rating"] == pytest.approx(112.0)
        assert result["pace"] == pytest.approx(100.0)
        assert result["dvp_rank"] == 15

    def test_compute_matchup_returns_four_keys(self, matchup):
        """Retorna exatamente as 4 chaves obrigatórias (pode ter mais, mas não menos)."""
        result = matchup.compute_matchup(None, None)
        required = {"def_rating", "pace", "dvp_rank", "dvp_total"}
        assert required.issubset(result.keys())


# ---------------------------------------------------------------------------
# compute_matchup — com dados reais
# ---------------------------------------------------------------------------

class TestComputeMatchupWithStats:
    def test_compute_matchup_with_stats(self, matchup):
        """Dados reais são refletidos no resultado."""
        stats = _make_team_stats(def_rating=108.5, pace=102.3)
        result = matchup.compute_matchup("Los Angeles Lakers", stats)
        assert result["def_rating"] == pytest.approx(108.5)
        assert result["pace"] == pytest.approx(102.3)

    def test_compute_matchup_def_rating_range(self, matchup):
        """def_rating deve estar no intervalo realista [80, 140]."""
        stats = _make_team_stats(def_rating=108.5, pace=102.3)
        result = matchup.compute_matchup("Los Angeles Lakers", stats)
        assert 80.0 <= result["def_rating"] <= 140.0

    def test_compute_matchup_pace_range(self, matchup):
        """pace deve estar no intervalo realista [80, 120]."""
        stats = _make_team_stats(def_rating=108.5, pace=102.3)
        result = matchup.compute_matchup("Los Angeles Lakers", stats)
        assert 80.0 <= result["pace"] <= 120.0

    def test_compute_matchup_with_none_team_stats(self, matchup):
        """team_name fornecido mas team_stats=None -> usa defaults."""
        result = matchup.compute_matchup("Boston Celtics", None)
        assert result["def_rating"] == pytest.approx(112.0)
        assert result["pace"] == pytest.approx(100.0)


# ---------------------------------------------------------------------------
# get_dvp_rank
# ---------------------------------------------------------------------------

class TestGetDvpRank:
    def test_dvp_rank_best_defense(self, matchup):
        """Time que concede menos pontos (menor def_rating) recebe rank mais alto (melhor defesa)."""
        all_stats = {
            "Boston Celtics": _make_team_stats(def_rating=105.0),   # melhor defesa
            "Golden State Warriors": _make_team_stats(def_rating=112.0),
            "Los Angeles Lakers": _make_team_stats(def_rating=118.0),  # pior defesa
        }
        # rank 1 = pior defesa (melhor para o atacante = maior def_rating)
        rank, total = matchup.get_dvp_rank("Los Angeles Lakers", all_stats)
        assert rank == 1
        assert total == 3

    def test_dvp_rank_worst_defense(self, matchup):
        """Time com melhor defesa recebe rank = total (mais difícil para atacante)."""
        all_stats = {
            "Boston Celtics": _make_team_stats(def_rating=105.0),   # melhor defesa
            "Golden State Warriors": _make_team_stats(def_rating=112.0),
            "Los Angeles Lakers": _make_team_stats(def_rating=118.0),
        }
        rank, total = matchup.get_dvp_rank("Boston Celtics", all_stats)
        assert rank == total  # pior rank para o atacante = melhor defesa
        assert total == 3

    def test_dvp_rank_not_found(self, matchup):
        """Time não encontrado -> (15, 30) — defaults de liga."""
        all_stats = {
            "Boston Celtics": _make_team_stats(def_rating=105.0),
        }
        rank, total = matchup.get_dvp_rank("Time Inexistente", all_stats)
        assert rank == 15
        assert total == 30

    def test_dvp_rank_single_team(self, matchup):
        """Com apenas 1 time no dict -> (1, 1)."""
        all_stats = {
            "Miami Heat": _make_team_stats(def_rating=110.0),
        }
        rank, total = matchup.get_dvp_rank("Miami Heat", all_stats)
        assert rank == 1
        assert total == 1

    def test_dvp_rank_empty_stats(self, matchup):
        """Dict vazio -> defaults (15, 30)."""
        rank, total = matchup.get_dvp_rank("Chicago Bulls", {})
        assert rank == 15
        assert total == 30
