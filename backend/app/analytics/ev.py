"""Cálculo de EV, probabilidade real, Kelly e classificação de apostas.

Preservado verbatim da lógica original (ev.py na raiz).
Única mudança: imports apontam para os módulos do novo pacote.
"""

from __future__ import annotations

import math

# Constantes default — espelham os valores de Settings.
# Carregadas do Settings em runtime (lifespan), mas ev.py é
# independentemente testável sem pydantic-settings instalado.
_RECENT_WEIGHT: float = 0.60
_SEASON_AVG_WEIGHT: float = 0.40
_PLAYOFF_HIST_MIN_GAMES: int = 5
_LEAGUE_AVG_DEF_RATING: float = 112.0
_LEAGUE_AVG_PACE: float = 100.0  # não usado diretamente aqui


def configure_from_settings() -> None:
    """Chamado no lifespan do FastAPI para sincronizar com Settings."""
    global _RECENT_WEIGHT, _SEASON_AVG_WEIGHT
    global _PLAYOFF_HIST_MIN_GAMES, _LEAGUE_AVG_DEF_RATING
    try:
        from app.core.config import get_settings

        s = get_settings()
        _RECENT_WEIGHT = s.recent_weight
        _SEASON_AVG_WEIGHT = s.season_avg_weight
        _PLAYOFF_HIST_MIN_GAMES = s.playoff_hist_min_games
        _LEAGUE_AVG_DEF_RATING = s.league_avg_def_rating
    except Exception:
        pass  # mantém defaults se Settings não disponível


# ── lookups de coluna ──────────────────────────────────────────────────────

_STAT_COL: dict[str, str] = {
    "player_points": "PTS",
    "player_rebounds": "REB",
    "player_assists": "AST",
    "player_threes": "FG3M",
    "player_blocks": "BLK",
    "player_steals": "STL",
    "player_points_rebounds_assists": "PRA",
    "player_points_rebounds": "PR",
    "player_points_assists": "PA",
    "player_rebounds_assists": "RA",
    "player_blocks_steals": "STOCKS",
}

_AVG_KEY: dict[str, str] = {
    "PTS": "avg_pts",
    "REB": "avg_reb",
    "AST": "avg_ast",
    "FG3M": "avg_3pm",
    "BLK": "avg_blk",
    "STL": "avg_stl",
    "PRA": "avg_pra",
    "PR": "avg_pr",
    "PA": "avg_pa",
    "RA": "avg_ra",
    "STOCKS": "avg_stocks",
}

_STD_KEY: dict[str, str] = {
    "PTS": "std_pts",
    "REB": "std_reb",
    "AST": "std_ast",
    "FG3M": "std_3pm",
    "BLK": "std_blk",
    "STL": "std_stl",
    "PRA": "std_pra",
    "PR": "std_pr",
    "PA": "std_pa",
    "RA": "std_ra",
    "STOCKS": "std_stocks",
}


# ── primitivos ─────────────────────────────────────────────────────────────


def implied_probability(odd_decimal: float) -> float:
    if odd_decimal <= 0:
        return 0.0
    return 1.0 / odd_decimal


def remove_vig(over_odd: float, under_odd: float) -> tuple[float, float]:
    if over_odd <= 0 or under_odd <= 0:
        return 0.5, 0.5
    p_over = 1.0 / over_odd
    p_under = 1.0 / under_odd
    total = p_over + p_under
    if total == 0:
        return 0.5, 0.5
    return p_over / total, p_under / total


def _norm_sf(x: float, mu: float, sigma: float) -> float:
    """P(X > x) para X ~ N(mu, sigma). Usa math.erfc — sem scipy."""
    if sigma <= 0:
        return 1.0 if mu > x else 0.0
    z = (x - mu) / (sigma * math.sqrt(2))
    return 0.5 * math.erfc(z)


def _ratio_to_prob(ratio: float) -> float:
    """Fallback quando std não está disponível."""
    if ratio >= 1.10:
        return 0.68
    if ratio >= 1.00:
        return 0.58
    if ratio >= 0.90:
        return 0.45
    if ratio >= 0.80:
        return 0.37
    return 0.28


# ── estimativa central ─────────────────────────────────────────────────────


def estimate_true_probability(
    player_stats: dict,
    line: float,
    direction: str,
    matchup: dict,
    market_key: str,
    playoff_history: dict | None = None,
    projected_minutes: float | None = None,
) -> float:
    # import tardio para manter o módulo testável sem pandas instalado globalmente
    from app.analytics.stats_parsing import games_over_line

    stat_col = _STAT_COL.get(market_key, "PTS")
    avg_key = _AVG_KEY.get(stat_col, "avg_pts")
    std_key = _STD_KEY.get(stat_col, "std_pts")
    season_avg_key = "season_" + avg_key

    avg_stat_orig = player_stats.get(avg_key, 0.0)
    std_stat_orig = player_stats.get(std_key, 0.0)
    minutes_avg = player_stats.get("minutes_avg", 0.0)

    # --- Passo 0: Cascata de minutos ---
    if projected_minutes and minutes_avg > 0 and projected_minutes != minutes_avg:
        min_ratio = projected_minutes / minutes_avg
        avg_stat = avg_stat_orig * min_ratio
        std_stat = std_stat_orig * math.sqrt(min_ratio) if std_stat_orig > 0 else 0.0
    else:
        avg_stat = avg_stat_orig
        std_stat = std_stat_orig
        min_ratio = 1.0

    # --- Passo 1: Probabilidade analítica via Normal CDF ---
    if std_stat > 0 and line > 0:
        prob_analytical = _norm_sf(line, avg_stat, std_stat)
    elif avg_stat > 0 and line > 0:
        prob_analytical = _ratio_to_prob(avg_stat / line)
    else:
        prob_analytical = 0.5

    # --- Passo 2: Frequência empírica ponderada no lookback ---
    prob_recent = games_over_line(player_stats, line, stat_col)
    if prob_recent == 0.0:
        prob_recent = prob_analytical

    prob_recent_blended = prob_recent * 0.6 + prob_analytical * 0.4

    # --- Passo 3: Âncora de longo prazo ---
    season_avg = player_stats.get(season_avg_key, 0.0)
    if season_avg > 0 and line > 0:
        season_prob = (
            _norm_sf(line, season_avg, std_stat_orig) if std_stat_orig > 0 else _ratio_to_prob(season_avg / line)
        )
    else:
        season_prob = prob_recent_blended

    p_over = prob_recent_blended * _RECENT_WEIGHT + season_prob * _SEASON_AVG_WEIGHT

    # --- Passo 4: Blend com histórico de playoffs (15%) ---
    is_playoffs = player_stats.get("is_playoffs", False)
    if is_playoffs and playoff_history and playoff_history.get("games", 0) >= _PLAYOFF_HIST_MIN_GAMES:
        hist_avg = playoff_history.get(avg_key, 0.0)
        if hist_avg > 0 and line > 0:
            hist_p = _norm_sf(line, hist_avg, std_stat_orig) if std_stat_orig > 0 else _ratio_to_prob(hist_avg / line)
            p_over = p_over * 0.85 + hist_p * 0.15

    # --- Passo 5: Ajuste defensivo ---
    def_rating = matchup.get("def_rating", _LEAGUE_AVG_DEF_RATING)
    pace = matchup.get("pace", _LEAGUE_AVG_PACE)
    L = _LEAGUE_AVG_DEF_RATING

    if def_rating >= L + 4:
        def_scale = 1.05
    elif def_rating >= L:
        def_scale = 1.02
    elif def_rating <= L - 6:
        def_scale = 0.94
    elif def_rating <= L - 2:
        def_scale = 0.97
    else:
        def_scale = 1.0

    if pace > 105:
        pace_scale = 1.03
    elif pace > 102:
        pace_scale = 1.02
    elif pace < 96:
        pace_scale = 0.98
    else:
        pace_scale = 1.0

    if (def_scale != 1.0 or pace_scale != 1.0) and std_stat > 0 and avg_stat > 0 and line > 0:
        adjusted_avg = avg_stat * def_scale * pace_scale
        p_defensive = _norm_sf(line, adjusted_avg, std_stat)
        p_over = p_over * 0.6 + p_defensive * 0.4
    else:
        if def_rating >= L + 4:
            p_over += 0.04
        elif def_rating >= L:
            p_over += 0.02
        elif def_rating <= L - 6:
            p_over -= 0.05
        elif def_rating <= L - 2:
            p_over -= 0.03

        if pace > 105:
            p_over += 0.03
        elif pace > 102:
            p_over += 0.02
        elif pace < 96:
            p_over -= 0.02

        if market_key == "player_points" and 0 < minutes_avg < 28:
            p_over -= 0.03

    # Shrinkage para amostras pequenas
    if player_stats.get("games_played", 0) < 5:
        p_over = (p_over + 0.5) / 2

    p_over = max(0.25, min(0.85, p_over))

    return p_over if direction == "over" else 1.0 - p_over


# ── utilitários de apostas ─────────────────────────────────────────────────


def calculate_ev(true_prob: float, odd_decimal: float) -> float:
    if odd_decimal <= 1.0:
        return 0.0
    profit_if_win = odd_decimal - 1.0
    ev = (true_prob * profit_if_win) - (1.0 - true_prob)
    return ev * 100.0


def kelly_fraction(true_prob: float, odd_decimal: float, kelly_divisor: float = 4.0) -> float:
    if odd_decimal <= 1.0 or kelly_divisor <= 0:
        return 0.0
    b = odd_decimal - 1.0
    q = 1.0 - true_prob
    kelly = (true_prob * b - q) / b
    return max(0.0, kelly / kelly_divisor)


def classify_bet(ev_percent: float, true_prob: float) -> str:
    if ev_percent >= 8.0 and true_prob >= 0.60:
        return "strong"
    if ev_percent >= 3.0:
        return "value"
    if ev_percent >= -1.0:
        return "neutral"
    return "avoid"
