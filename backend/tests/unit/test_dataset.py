"""Testes puros do construtor de dataset de treino (A4) — sem DB.

Focam nas garantias que importam para a Fase 2: corte temporal estrito (nenhuma
feature usa o jogo-alvo ou futuros), labels corretos, ausência de NaN e a
distinção linha real × sintética.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from app.analytics.dataset import FEATURE_COLUMNS, GameLog, build_player_rows

BASE = date(2025, 11, 1)


def _mk(day: int, *, pts=None, reb=None, ast=None, pra=None, minutes=30.0, home=True, playoff=False, opp="LAL"):
    stats: dict[str, float] = {}
    if pts is not None:
        stats["PTS"] = float(pts)
    if reb is not None:
        stats["REB"] = float(reb)
    if ast is not None:
        stats["AST"] = float(ast)
    if pra is not None:
        stats["PRA"] = float(pra)
    return GameLog(
        game_date=BASE + timedelta(days=day),
        is_playoff=playoff,
        is_home=home,
        opponent_abbr=opp,
        min_played=minutes,
        stats=stats,
        player_id=1,
        player_name="Test Player",
        season="2025-26",
    )


def test_min_history_skips_early_games():
    logs = [_mk(i, pts=i) for i in range(12)]
    rows = build_player_rows(logs, ["player_points"], min_history=5)
    # Os 5 primeiros jogos (0..4) não têm histórico suficiente → sem linha.
    assert len(rows) == 12 - 5
    assert min(r["game_date"] for r in rows) == BASE + timedelta(days=5)


def test_temporal_cutoff_no_leakage():
    """Features do jogo-alvo usam SÓ jogos anteriores — o próprio valor não vaza."""
    logs = [_mk(i, pts=i) for i in range(12)]  # pts 0..11 em dias consecutivos
    rows = build_player_rows(logs, ["player_points"], min_history=5)

    r10 = next(r for r in rows if r["game_date"] == BASE + timedelta(days=10))
    # prior do jogo 10 = pts [0..9]
    assert r10["avg_10"] == pytest.approx(4.5)  # média de 0..9
    assert r10["avg_5"] == pytest.approx(7.0)  # média de 5..9
    assert r10["games_prior"] == 10
    assert r10["actual"] == 10.0

    # Vaza? Estoura o pts do PRÓPRIO jogo 10 para 999 — suas features não podem mudar.
    logs2 = list(logs)
    logs2[10] = _mk(10, pts=999)
    rows2 = build_player_rows(logs2, ["player_points"], min_history=5)
    r10b = next(r for r in rows2 if r["game_date"] == BASE + timedelta(days=10))
    assert r10b["avg_10"] == pytest.approx(4.5)  # inalterado
    assert r10b["avg_5"] == pytest.approx(7.0)
    assert r10b["actual"] == 999.0  # o alvo em si mudou (é o label, não feature)


def test_labels_over_line():
    logs = [_mk(i, pts=20) for i in range(10)]  # média estável 20 → linha sintética 20.0
    # Jogo-alvo com pts acima e abaixo da linha
    logs.append(_mk(10, pts=30))  # >= 20 → label 1
    logs.append(_mk(11, pts=5))  # < 20 → label 0
    rows = build_player_rows(logs, ["player_points"], min_history=5, synth_window=10)

    r_over = next(r for r in rows if r["game_date"] == BASE + timedelta(days=10))
    r_under = next(r for r in rows if r["game_date"] == BASE + timedelta(days=11))
    assert r_over["line"] == pytest.approx(20.0)
    assert r_over["line_source"] == "synthetic"
    assert r_over["label"] == 1
    assert r_under["label"] == 0


def test_no_nan_in_required_columns():
    logs = [_mk(i, pts=10 + i, reb=5, ast=4, pra=19 + i, minutes=28.0) for i in range(15)]
    rows = build_player_rows(logs, ["player_points", "player_points_rebounds_assists"], min_history=5)
    assert rows
    for r in rows:
        for col in FEATURE_COLUMNS:
            assert col in r, f"coluna {col} ausente"
            assert r[col] is not None, f"coluna {col} é None"
            assert r[col] == r[col], f"coluna {col} é NaN"  # NaN != NaN


def test_line_source_real_overrides_synthetic():
    logs = [_mk(i, pts=20) for i in range(10)]

    def provider(_name, d, market):
        if market == "player_points" and d == BASE + timedelta(days=6):
            return 27.5
        return None

    rows = build_player_rows(logs, ["player_points"], min_history=5, line_provider=provider)
    real = next(r for r in rows if r["game_date"] == BASE + timedelta(days=6))
    assert real["line_source"] == "real"
    assert real["line"] == pytest.approx(27.5)
    assert real["label"] == 0  # pts 20 < linha 27.5
    assert any(r["line_source"] == "synthetic" for r in rows)


def test_rest_days_and_back_to_back():
    logs = [_mk(0, pts=10), _mk(1, pts=10), _mk(2, pts=10), _mk(3, pts=10), _mk(4, pts=10)]
    logs.append(_mk(5, pts=10))  # dia seguinte → b2b
    logs.append(_mk(9, pts=10))  # 4 dias depois → descanso 4
    rows = build_player_rows(logs, ["player_points"], min_history=5)

    r_b2b = next(r for r in rows if r["game_date"] == BASE + timedelta(days=5))
    r_rest = next(r for r in rows if r["game_date"] == BASE + timedelta(days=9))
    assert r_b2b["rest_days"] == 1 and r_b2b["back_to_back"] == 1
    assert r_rest["rest_days"] == 4 and r_rest["back_to_back"] == 0


def test_context_flags_and_low_volume_line_floor():
    # Stat de baixo volume (blocks) com média ~0 → linha sintética não pode ser 0.
    logs = [_mk(i, pts=10, home=(i % 2 == 0), playoff=(i >= 8)) for i in range(10)]
    for g in logs:
        g.stats["BLK"] = 0.0
    rows = build_player_rows(logs, ["player_blocks"], min_history=5)
    for r in rows:
        assert r["line"] >= 0.5  # piso aplicado
    # is_home / is_playoff refletem o jogo-alvo
    r8 = next(r for r in rows if r["game_date"] == BASE + timedelta(days=8))
    assert r8["is_playoff"] == 1
    assert r8["is_home"] == 1  # dia 8 é par


def test_deterministic_and_stable_order():
    logs = [_mk(i, pts=10 + (i % 3)) for i in range(12)]
    a = build_player_rows(logs, ["player_points"], min_history=5)
    b = build_player_rows(list(reversed(logs)), ["player_points"], min_history=5)
    # Mesma entrada (ordem interna é normalizada) → mesma saída.
    assert a == b
