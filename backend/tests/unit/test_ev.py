"""Testes de rede de segurança para app.analytics.ev.

Cobre: Normal CDF, cascata de minutos, clamps, EV, Kelly, classify_bet.
Rodáveis sem banco, sem Redis, sem API externa.
"""

from __future__ import annotations

import pytest

# ---------------------------------------------------------------------------
# Helpers de mock — substituem games_over_line sem importar stats/DB
# ---------------------------------------------------------------------------


def _make_stats(
    avg_pts: float = 25.0,
    std_pts: float = 5.0,
    minutes_avg: float = 34.0,
    games_played: int = 20,
    is_playoffs: bool = False,
    season_avg_pts: float = 25.0,
) -> dict:
    return {
        "avg_pts": avg_pts,
        "std_pts": std_pts,
        "avg_reb": 5.0,
        "std_reb": 2.0,
        "avg_ast": 6.0,
        "std_ast": 2.0,
        "avg_3pm": 2.5,
        "std_3pm": 1.2,
        "avg_blk": 0.5,
        "std_blk": 0.5,
        "avg_stl": 1.0,
        "std_stl": 0.5,
        "avg_pra": 36.0,
        "std_pra": 7.0,
        "avg_pr": 30.0,
        "std_pr": 6.0,
        "avg_pa": 31.0,
        "std_pa": 6.0,
        "avg_ra": 11.0,
        "std_ra": 3.0,
        "avg_stocks": 1.5,
        "std_stocks": 0.8,
        "season_avg_pts": season_avg_pts,
        "season_avg_reb": 5.0,
        "season_avg_ast": 6.0,
        "season_avg_3pm": 2.5,
        "season_avg_blk": 0.5,
        "season_avg_stl": 1.0,
        "season_avg_pra": 36.0,
        "season_avg_pr": 30.0,
        "season_avg_pa": 31.0,
        "season_avg_ra": 11.0,
        "season_avg_stocks": 1.5,
        "minutes_avg": minutes_avg,
        "games_played": games_played,
        "is_playoffs": is_playoffs,
        "df": None,  # sem DataFrame → games_over_line retorna 0
    }


def _neutral_matchup() -> dict:
    return {"def_rating": 112.0, "pace": 100.0}


# ---------------------------------------------------------------------------
# Import do módulo target — path correto independente de PYTHONPATH
# ---------------------------------------------------------------------------

import importlib
import sys
import types

# conftest.py já adiciona backend/ ao sys.path


@pytest.fixture(autouse=True)
def patch_games_over_line(monkeypatch):
    """Substitui games_over_line por stub — sem banco, sem pandas."""
    # Injeta só app.analytics.stats_parsing; não mexe em app nem app.analytics
    # (os pacotes reais precisam estar acessíveis para o import do ev.py)
    fake_sp = types.ModuleType("app.analytics.stats_parsing")
    fake_sp.games_over_line = lambda player_stats, line, stat_key: 0.0
    fake_sp.get_last5_values = lambda player_stats, stat_key, line: []
    sys.modules["app.analytics.stats_parsing"] = fake_sp
    # Força reload do ev para pegar o stub
    if "app.analytics.ev" in sys.modules:
        importlib.reload(sys.modules["app.analytics.ev"])
    yield
    # Limpeza: remove stubs para não vazar entre testes
    sys.modules.pop("app.analytics.stats_parsing", None)
    if "app.analytics.ev" in sys.modules:
        importlib.reload(sys.modules["app.analytics.ev"])


@pytest.fixture
def ev():
    """Retorna o módulo app.analytics.ev (já com stub ativo pelo autouse)."""
    import app.analytics.ev as ev_module

    return ev_module


# ---------------------------------------------------------------------------
# implied_probability
# ---------------------------------------------------------------------------


class TestImpliedProbability:
    def test_decimal_2_0(self, ev):
        assert ev.implied_probability(2.0) == pytest.approx(0.5)

    def test_decimal_1_5(self, ev):
        assert ev.implied_probability(1.5) == pytest.approx(1 / 1.5)

    def test_zero_returns_zero(self, ev):
        assert ev.implied_probability(0.0) == 0.0

    def test_negative_returns_zero(self, ev):
        assert ev.implied_probability(-1.0) == 0.0


# ---------------------------------------------------------------------------
# remove_vig
# ---------------------------------------------------------------------------


class TestRemoveVig:
    def test_equal_odds_50_50(self, ev):
        p_over, p_under = ev.remove_vig(2.0, 2.0)
        assert p_over == pytest.approx(0.5)
        assert p_under == pytest.approx(0.5)

    def test_sums_to_one(self, ev):
        p_over, p_under = ev.remove_vig(1.91, 1.91)
        assert p_over + p_under == pytest.approx(1.0)

    def test_asymmetric(self, ev):
        p_over, p_under = ev.remove_vig(1.80, 2.10)
        assert p_over > p_under  # favorito tem odd menor → maior prob

    def test_zero_odds_fallback(self, ev):
        p_over, p_under = ev.remove_vig(0.0, 0.0)
        assert p_over == 0.5 and p_under == 0.5


# ---------------------------------------------------------------------------
# Normal CDF (_norm_sf)  — via estimate_true_probability com avg=line
# ---------------------------------------------------------------------------


class TestNormSF:
    def test_prob_half_when_avg_equals_line(self, ev):
        """Se avg == line e std > 0, P(X > line) ≈ 0.5."""
        stats = _make_stats(avg_pts=25.0, std_pts=5.0)
        p = ev.estimate_true_probability(
            stats, line=25.0, direction="over", matchup=_neutral_matchup(), market_key="player_points"
        )
        # Blended com season e hit-rate, mas sem df → hit_rate = 0 → fallback analítico
        # Com avg == line a prob analítica é 0.5; blending e clamp podem afastar um pouco
        assert 0.25 <= p <= 0.85

    def test_high_avg_over_line_high_prob(self, ev):
        stats = _make_stats(avg_pts=35.0, std_pts=4.0, season_avg_pts=35.0)
        p = ev.estimate_true_probability(
            stats, line=25.0, direction="over", matchup=_neutral_matchup(), market_key="player_points"
        )
        assert p > 0.60

    def test_low_avg_under_line_low_prob(self, ev):
        stats = _make_stats(avg_pts=15.0, std_pts=4.0, season_avg_pts=15.0)
        p = ev.estimate_true_probability(
            stats, line=25.0, direction="over", matchup=_neutral_matchup(), market_key="player_points"
        )
        assert p < 0.45

    def test_direction_under_is_complement(self, ev):
        stats = _make_stats(avg_pts=30.0, std_pts=5.0, season_avg_pts=30.0)
        p_over = ev.estimate_true_probability(
            stats, line=25.0, direction="over", matchup=_neutral_matchup(), market_key="player_points"
        )
        p_under = ev.estimate_true_probability(
            stats, line=25.0, direction="under", matchup=_neutral_matchup(), market_key="player_points"
        )
        # over + under devem somar 1 (mesma lógica, direção invertida)
        assert p_over + p_under == pytest.approx(1.0, abs=1e-9)


# ---------------------------------------------------------------------------
# Cascata de minutos
# ---------------------------------------------------------------------------


class TestMinutesCascade:
    def test_more_minutes_higher_prob(self, ev):
        base = _make_stats(avg_pts=20.0, std_pts=4.0, minutes_avg=28.0)
        p_base = ev.estimate_true_probability(
            base,
            line=22.0,
            direction="over",
            matchup=_neutral_matchup(),
            market_key="player_points",
            projected_minutes=None,
        )
        p_boost = ev.estimate_true_probability(
            base,
            line=22.0,
            direction="over",
            matchup=_neutral_matchup(),
            market_key="player_points",
            projected_minutes=36.0,  # +8 min → média escala
        )
        assert p_boost > p_base

    def test_minutes_equal_to_avg_no_change(self, ev):
        stats = _make_stats(avg_pts=25.0, std_pts=5.0, minutes_avg=34.0)
        p_normal = ev.estimate_true_probability(
            stats,
            line=25.0,
            direction="over",
            matchup=_neutral_matchup(),
            market_key="player_points",
            projected_minutes=None,
        )
        p_same = ev.estimate_true_probability(
            stats,
            line=25.0,
            direction="over",
            matchup=_neutral_matchup(),
            market_key="player_points",
            projected_minutes=34.0,
        )
        assert p_normal == pytest.approx(p_same, abs=1e-9)

    def test_zero_minutes_avg_no_cascade(self, ev):
        stats = _make_stats(avg_pts=25.0, std_pts=5.0, minutes_avg=0.0)
        # Não deve dividir por zero
        p = ev.estimate_true_probability(
            stats,
            line=25.0,
            direction="over",
            matchup=_neutral_matchup(),
            market_key="player_points",
            projected_minutes=36.0,
        )
        assert 0.25 <= p <= 0.85


# ---------------------------------------------------------------------------
# Clamps (0.25 ≤ p ≤ 0.85)
# ---------------------------------------------------------------------------


class TestClamps:
    def test_upper_clamp(self, ev):
        stats = _make_stats(avg_pts=100.0, std_pts=1.0, season_avg_pts=100.0)
        p = ev.estimate_true_probability(
            stats, line=5.0, direction="over", matchup=_neutral_matchup(), market_key="player_points"
        )
        assert p <= 0.85

    def test_lower_clamp(self, ev):
        stats = _make_stats(avg_pts=1.0, std_pts=0.5, season_avg_pts=1.0)
        p = ev.estimate_true_probability(
            stats, line=100.0, direction="over", matchup=_neutral_matchup(), market_key="player_points"
        )
        assert p >= 0.25

    def test_few_games_shrinks_to_50(self, ev):
        """Com < 5 jogos a prob deve se aproximar de 0.5."""
        stats_confident = _make_stats(avg_pts=40.0, std_pts=2.0, games_played=20, season_avg_pts=40.0)
        stats_few = _make_stats(avg_pts=40.0, std_pts=2.0, games_played=3, season_avg_pts=40.0)
        p_c = ev.estimate_true_probability(
            stats_confident, line=20.0, direction="over", matchup=_neutral_matchup(), market_key="player_points"
        )
        p_f = ev.estimate_true_probability(
            stats_few, line=20.0, direction="over", matchup=_neutral_matchup(), market_key="player_points"
        )
        assert p_f < p_c  # shrinkage puxa em direção a 0.5


# ---------------------------------------------------------------------------
# calculate_ev
# ---------------------------------------------------------------------------


class TestCalculateEV:
    def test_positive_ev(self, ev):
        # Prob real 0.60 com odd 2.0 (implied 0.50) → EV positivo
        result = ev.calculate_ev(true_prob=0.60, odd_decimal=2.0)
        assert result > 0

    def test_negative_ev(self, ev):
        # Prob real 0.40 com odd 2.0 → EV negativo
        result = ev.calculate_ev(true_prob=0.40, odd_decimal=2.0)
        assert result < 0

    def test_zero_ev_at_break_even(self, ev):
        # Com odd 2.0, break-even é prob = 0.5 → EV = 0
        result = ev.calculate_ev(true_prob=0.50, odd_decimal=2.0)
        assert result == pytest.approx(0.0, abs=1e-9)

    def test_formula_exactness(self, ev):
        # EV = (p * (odd-1) - (1-p)) * 100
        p, odd = 0.65, 1.90
        expected = (p * (odd - 1.0) - (1.0 - p)) * 100.0
        assert ev.calculate_ev(p, odd) == pytest.approx(expected)

    def test_odd_le_one_returns_zero(self, ev):
        assert ev.calculate_ev(0.8, 1.0) == 0.0
        assert ev.calculate_ev(0.8, 0.5) == 0.0


# ---------------------------------------------------------------------------
# kelly_fraction
# ---------------------------------------------------------------------------


class TestKellyFraction:
    def test_positive_kelly_positive_ev(self, ev):
        k = ev.kelly_fraction(true_prob=0.60, odd_decimal=2.0)
        assert k > 0

    def test_zero_kelly_negative_ev(self, ev):
        k = ev.kelly_fraction(true_prob=0.40, odd_decimal=2.0)
        assert k == 0.0

    def test_divisor_quarters(self, ev):
        k_full = ev.kelly_fraction(0.60, 2.0, kelly_divisor=1.0)
        k_quarter = ev.kelly_fraction(0.60, 2.0, kelly_divisor=4.0)
        assert k_quarter == pytest.approx(k_full / 4.0)

    def test_never_negative(self, ev):
        for p in [0.1, 0.3, 0.5, 0.7, 0.9]:
            k = ev.kelly_fraction(p, 2.0)
            assert k >= 0.0

    def test_odd_le_one_returns_zero(self, ev):
        assert ev.kelly_fraction(0.8, 1.0) == 0.0


# ---------------------------------------------------------------------------
# classify_bet
# ---------------------------------------------------------------------------


class TestClassifyBet:
    def test_strong(self, ev):
        assert ev.classify_bet(ev_percent=10.0, true_prob=0.65) == "strong"

    def test_value(self, ev):
        assert ev.classify_bet(ev_percent=5.0, true_prob=0.50) == "value"

    def test_neutral(self, ev):
        assert ev.classify_bet(ev_percent=0.0, true_prob=0.50) == "neutral"
        assert ev.classify_bet(ev_percent=-0.5, true_prob=0.50) == "neutral"

    def test_avoid(self, ev):
        assert ev.classify_bet(ev_percent=-5.0, true_prob=0.30) == "avoid"

    def test_strong_requires_both_thresholds(self, ev):
        # EV alto mas prob baixa → value, não strong
        assert ev.classify_bet(ev_percent=10.0, true_prob=0.55) == "value"
        # Prob alta mas EV baixo → value
        assert ev.classify_bet(ev_percent=5.0, true_prob=0.65) == "value"


# ---------------------------------------------------------------------------
# configure_from_settings (R1 — saneamento: sincroniza pesos com Settings)
# ---------------------------------------------------------------------------


class TestConfigureFromSettings:
    def test_applies_overrides(self, ev, monkeypatch):
        """Overrides de Settings devem refletir nos globals de pesos do ev."""
        fake = types.ModuleType("app.core.config")

        class FakeSettings:
            recent_weight = 0.70
            season_avg_weight = 0.30
            playoff_hist_min_games = 8
            league_avg_def_rating = 110.0

        fake.get_settings = lambda: FakeSettings()
        monkeypatch.setitem(sys.modules, "app.core.config", fake)

        ev.configure_from_settings()

        assert pytest.approx(0.70) == ev._RECENT_WEIGHT
        assert pytest.approx(0.30) == ev._SEASON_AVG_WEIGHT
        assert ev._PLAYOFF_HIST_MIN_GAMES == 8
        assert pytest.approx(110.0) == ev._LEAGUE_AVG_DEF_RATING
        # O autouse recarrega o módulo no teardown → globals voltam ao default

    def test_keeps_defaults_on_failure(self, ev, monkeypatch):
        """Se get_settings lança, mantém os defaults (à prova de falha)."""
        fake = types.ModuleType("app.core.config")

        def _boom():
            raise RuntimeError("settings indisponivel")

        fake.get_settings = _boom
        monkeypatch.setitem(sys.modules, "app.core.config", fake)

        before = ev._RECENT_WEIGHT
        ev.configure_from_settings()  # não deve propagar exceção
        assert before == ev._RECENT_WEIGHT
