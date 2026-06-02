"""Funções puras de parsing de stats — sem I/O, sem DB, testáveis isoladamente.

Extraídas de stats.py (atual). Operam sobre DataFrames já carregados,
vindos do data warehouse (player_game_logs) ou da ESPN API.
"""
from __future__ import annotations

import pandas as pd

from app.core.config import get_settings


def games_over_line(player_stats: dict, line: float, stat_key: str) -> float:
    """Frequência ponderada de jogos em que o jogador superou a linha.

    Usa decay exponencial: jogo mais recente tem peso 1.0, cada jogo anterior
    multiplica por DECAY_FACTOR (0.9^i). Evita que desempenhos antigos pesem
    tanto quanto os recentes no cálculo de probabilidade.

    player_stats: dict retornado por get_player_recent_stats ou montado a
    partir do data warehouse; deve conter 'df' (DataFrame cronológico).
    """
    cfg = get_settings()
    df = player_stats.get("df")
    if df is None or df.empty or stat_key not in df.columns:
        return 0.0

    series = pd.to_numeric(df[stat_key], errors="coerce").dropna().reset_index(drop=True)
    if series.empty:
        return 0.0

    n = len(series)
    weights = pd.Series([cfg.decay_factor ** (n - 1 - i) for i in range(n)])
    over_flags = (series > line).astype(float)
    total_weight = weights.sum()
    if total_weight == 0:
        return 0.0
    return float((weights * over_flags).sum() / total_weight)


def get_last5_values(player_stats: dict, stat_key: str, line: float) -> list[dict]:
    """Últimos 5 valores da stat para o TrendSparkline no frontend."""
    df = player_stats.get("df")
    if df is None or df.empty or stat_key not in df.columns:
        return []
    series = pd.to_numeric(df[stat_key], errors="coerce").dropna()
    return [{"value": round(float(v), 1), "hit": float(v) > line} for v in series.tail(5).tolist()]
