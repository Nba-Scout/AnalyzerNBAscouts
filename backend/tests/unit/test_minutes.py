"""Testes unitários para app.analytics.minutes.

Cobre: compute_freed_minutes, compute_projected_minutes.
Rodáveis sem banco, sem Redis, sem API externa.

Interface esperada do módulo:
    compute_freed_minutes(injuries: list[dict], player_stats_cache: dict) -> float
        - injuries: lista de {player_id, status, name}
        - player_stats_cache: {player_id: {"minutes_avg": float, ...}}
        - Soma minutes_avg dos jogadores com status "Out" ou "Doubtful"

    compute_projected_minutes(minutes_avg: float, freed_minutes: float) -> float
        - Redistribui proporcionalmente minutos liberados
        - Clamp: resultado <= 48.0, resultado >= 0.0
        - Cap: resultado <= minutes_avg * 1.15
"""

from __future__ import annotations

import pytest

# conftest.py já adiciona backend/ ao sys.path


# ---------------------------------------------------------------------------
# Fixture: importa o módulo (criado em paralelo no Passo 2)
# ---------------------------------------------------------------------------


@pytest.fixture
def minutes():
    """Retorna o módulo app.analytics.minutes."""
    import app.analytics.minutes as module

    return module


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _injury(player_id: str, status: str = "Out", name: str = "Player") -> dict:
    return {"player_id": player_id, "status": status, "name": name}


def _stats_cache(player_id: str, minutes_avg: float) -> dict:
    return {player_id: {"minutes_avg": minutes_avg}}


# ---------------------------------------------------------------------------
# compute_freed_minutes
# ---------------------------------------------------------------------------


class TestComputeFreedMinutes:
    def test_freed_empty(self, minutes):
        """Lista vazia e cache vazio -> 0.0."""
        assert minutes.compute_freed_minutes([], {}) == pytest.approx(0.0)

    def test_freed_not_in_roster(self, minutes):
        """Jogador com status 'Out' mas sem entrada no cache -> 0.0."""
        injuries = [_injury("999", status="Out")]
        result = minutes.compute_freed_minutes(injuries, {})
        assert result == pytest.approx(0.0)

    def test_freed_one_injured(self, minutes):
        """1 jogador 'Out' com 30 min/jogo -> freed = 30.0."""
        injuries = [_injury("1", status="Out")]
        cache = _stats_cache("1", 30.0)
        result = minutes.compute_freed_minutes(injuries, cache)
        assert result > 0.0
        assert result == pytest.approx(30.0)

    def test_freed_multiple(self, minutes):
        """Soma de múltiplos jogadores 'Out'."""
        injuries = [
            _injury("1", status="Out"),
            _injury("2", status="Out"),
        ]
        cache = {"1": {"minutes_avg": 28.0}, "2": {"minutes_avg": 20.0}}
        result = minutes.compute_freed_minutes(injuries, cache)
        assert result == pytest.approx(48.0)

    def test_freed_questionable_not_counted(self, minutes):
        """Status 'Questionable' não conta para freed minutes."""
        injuries = [_injury("1", status="Questionable")]
        cache = _stats_cache("1", 30.0)
        result = minutes.compute_freed_minutes(injuries, cache)
        assert result == pytest.approx(0.0)

    def test_freed_doubtful_counted(self, minutes):
        """Status 'Doubtful' conta para freed minutes (assim como 'Out')."""
        injuries = [_injury("1", status="Doubtful")]
        cache = _stats_cache("1", 25.0)
        result = minutes.compute_freed_minutes(injuries, cache)
        assert result == pytest.approx(25.0)

    def test_freed_no_player_id(self, minutes):
        """Entrada de lesão sem player_id -> ignorada."""
        injuries = [{"player_id": "", "status": "Out", "name": "Unknown"}]
        result = minutes.compute_freed_minutes(injuries, {})
        assert result == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# compute_projected_minutes
# ---------------------------------------------------------------------------


class TestComputeProjectedMinutes:
    def test_projected_no_freed(self, minutes):
        """Sem minutos liberados -> projeção igual à média."""
        result = minutes.compute_projected_minutes(minutes_avg=30.0, freed_minutes=0.0)
        assert result == pytest.approx(30.0)

    def test_projected_with_freed(self, minutes):
        """Com minutos liberados -> projeção maior que a média."""
        result = minutes.compute_projected_minutes(minutes_avg=30.0, freed_minutes=10.0)
        assert result > 30.0

    def test_projected_cap_15pct(self, minutes):
        """Cap de 15%: resultado <= minutes_avg * 1.15."""
        result = minutes.compute_projected_minutes(minutes_avg=30.0, freed_minutes=10.0)
        assert result <= 30.0 * 1.15

    def test_projected_clamp_48(self, minutes):
        """freed muito grande -> resultado clampado a <= 48.0."""
        result = minutes.compute_projected_minutes(minutes_avg=30.0, freed_minutes=200.0)
        assert result <= 48.0

    def test_projected_clamp_zero(self, minutes):
        """minutes_avg=0 -> resultado >= 0.0 (sem divisão por zero)."""
        result = minutes.compute_projected_minutes(minutes_avg=0.0, freed_minutes=10.0)
        assert result >= 0.0

    def test_projected_no_change_when_zero_freed(self, minutes):
        """freed=0, minutes_avg=25 -> exatamente 25.0."""
        result = minutes.compute_projected_minutes(minutes_avg=25.0, freed_minutes=0.0)
        assert result == pytest.approx(25.0)

    def test_projected_result_is_non_negative(self, minutes):
        """Resultado nunca negativo, independente dos inputs."""
        for avg in [0.0, 5.0, 20.0, 40.0]:
            for freed in [0.0, 10.0, 50.0]:
                result = minutes.compute_projected_minutes(minutes_avg=avg, freed_minutes=freed)
                assert result >= 0.0, f"Resultado negativo para avg={avg}, freed={freed}"

    def test_projected_monotone_freed(self, minutes):
        """Mais minutos liberados -> projeção maior ou igual (monotone)."""
        r1 = minutes.compute_projected_minutes(minutes_avg=28.0, freed_minutes=5.0)
        r2 = minutes.compute_projected_minutes(minutes_avg=28.0, freed_minutes=15.0)
        # r2 pode ser igual a r1 se ambos estão no cap, mas nunca menor
        assert r2 >= r1

    def test_projected_never_above_48(self, minutes):
        """Resultado nunca excede limite fisiológico de 48 minutos."""
        for freed in [0.0, 50.0, 100.0, 240.0]:
            result = minutes.compute_projected_minutes(minutes_avg=40.0, freed_minutes=freed)
            assert result <= 48.0
