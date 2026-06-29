"""Modo demo async — gera props sinteticas a partir de dados reais da ESPN.

Versao async de demo.py da raiz. Toda a logica de negocio e preservada:
seed random=42, filtros MIN_GAMES_REQUIRED / MIN_AVG_PTS / MIN_AVG_MIN,
ordenacao por avg_pts desc, MAX_PLAYERS_PER_TEAM, formato identico ao de
analyze_day().

Usado automaticamente quando a Odds API nao retorna player props.
"""

from __future__ import annotations

import asyncio
import logging
import random

from app.core.constants import MARKET_LABELS

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

MAX_PLAYERS_PER_TEAM = 6
MIN_GAMES_REQUIRED = 8
MIN_AVG_PTS = 6.0
MIN_AVG_MIN = 14.0

DEMO_MARKETS = [
    "player_points",
    "player_rebounds",
    "player_assists",
    "player_threes",
    "player_points_rebounds_assists",
]

# Matchup neutro (media da liga) para nao distorcer EV no demo
_NEUTRAL_MATCHUP = {
    "def_rating": 112.0,
    "pace": 100.0,
    "dvp_rank": 15,
    "dvp_total": 30,
}

_AVG_KEY: dict[str, str] = {
    "player_points": "avg_pts",
    "player_rebounds": "avg_reb",
    "player_assists": "avg_ast",
    "player_threes": "avg_3pm",
    "player_points_rebounds_assists": "avg_pra",
}

_STAT_COL: dict[str, str] = {
    "player_points": "PTS",
    "player_rebounds": "REB",
    "player_assists": "AST",
    "player_threes": "FG3M",
    "player_points_rebounds_assists": "PRA",
}


# ---------------------------------------------------------------------------
# Utilitarios
# ---------------------------------------------------------------------------


def _round_half(value: float) -> float:
    """Arredonda para o 0,5 mais proximo (ex: 24.3 -> 24.5, 6.8 -> 7.0)."""
    return round(value * 2) / 2


def _synthetic_line(avg: float) -> float:
    """Linha sintetica proxima da media, com leve desconto para simular bookmaker."""
    factor = random.uniform(0.90, 0.97)
    return _round_half(avg * factor)


def _synthetic_odds() -> float:
    """Odd decimal em torno de -110 americano (1.82-2.05)."""
    return round(random.uniform(1.82, 2.05), 2)


# ---------------------------------------------------------------------------
# Logica principal
# ---------------------------------------------------------------------------


async def _get_active_players(roster: dict, n_games: int = 20) -> list[tuple[str, dict]]:
    """Busca stats de todos os jogadores do roster em paralelo e filtra os ativos.

    Criterios de atividade (identicos ao demo.py legado):
      - games_played >= MIN_GAMES_REQUIRED
      - avg_pts >= MIN_AVG_PTS
      - minutes_avg >= MIN_AVG_MIN

    Retorna lista de (player_id, stats) ordenada por avg_pts desc,
    truncada em MAX_PLAYERS_PER_TEAM.
    """
    from app.services.players import get_player_stats

    async def _fetch(pid: str) -> tuple[str, dict | None]:
        stats = await get_player_stats(pid, n_games=n_games)
        return pid, stats

    results = await asyncio.gather(*[_fetch(pid) for pid in roster])

    candidates: list[tuple[str, dict, float]] = []
    for pid, pstats in results:
        if pstats is None:
            continue
        if pstats.get("games_played", 0) < MIN_GAMES_REQUIRED:
            continue
        avg_pts = pstats.get("avg_pts", 0.0)
        if avg_pts < MIN_AVG_PTS:
            continue
        avg_min = pstats.get("minutes_avg", 0.0)
        if avg_min < MIN_AVG_MIN:
            continue
        candidates.append((pid, pstats, avg_pts))

    # Ordena pelos maiores scorers — garante titulares no topo
    candidates.sort(key=lambda x: x[2], reverse=True)
    return [(pid, pstats) for pid, pstats, _ in candidates[:MAX_PLAYERS_PER_TEAM]]


async def generate_demo_entries(nba_games: list[dict]) -> list[dict]:
    """Gera props sinteticas para todos os jogos da lista.

    Para cada jogo busca os principais jogadores de cada time via ESPN
    (filtrados e ordenados por relevancia) e calcula EV sobre stats reais
    com linhas e odds sinteticas.

    Preserva seed random=42 para reprodutibilidade no mesmo dia.
    Formato de saida identico a analyze_day() / scout.analyze_day().
    """
    from app.analytics.ev import (
        calculate_ev,
        classify_bet,
        estimate_true_probability,
        implied_probability,
        kelly_fraction,
    )
    from app.analytics.stats_parsing import games_over_line, get_last5_values
    from app.core.teams import team_abbr as get_team_abbr
    from app.services.players import get_team_roster

    entries: list[dict] = []
    rng = random.Random(42)  # seed fixo para reprodutibilidade no mesmo dia

    for game in nba_games:
        home_name = game.get("home_team", "")
        away_name = game.get("away_team", "")

        for player_team_name, opp_team_name in [
            (home_name, away_name),
            (away_name, home_name),
        ]:
            team_abbr = get_team_abbr(player_team_name)
            opp_abbr = get_team_abbr(opp_team_name)

            roster = await get_team_roster(team_abbr)
            if not roster:
                log.warning("[demo] sem roster para %s", team_abbr)
                continue

            active_players = await _get_active_players(roster)
            if not active_players:
                log.warning("[demo] nenhum jogador ativo para %s", team_abbr)
                continue

            log.info(
                "[demo] %s: %d jogadores ativos",
                team_abbr,
                len(active_players),
            )

            for pid, pstats in active_players:
                player_name = roster.get(pid) or f"Player {pid}"

                for market_key in DEMO_MARKETS:
                    avg_key = _AVG_KEY[market_key]
                    avg_val = pstats.get(avg_key, 0.0)
                    if avg_val < 1.0:
                        continue  # mercado sem relevancia para este jogador

                    line = _synthetic_line(avg_val)
                    odd = _synthetic_odds()
                    direction = "over"

                    true_prob = estimate_true_probability(pstats, line, direction, _NEUTRAL_MATCHUP, market_key)
                    ev_pct = calculate_ev(true_prob, odd)
                    kelly = kelly_fraction(true_prob, odd)
                    classif = classify_bet(ev_pct, true_prob)
                    hit_rate = games_over_line(pstats, line, _STAT_COL[market_key])
                    last5 = get_last5_values(pstats, _STAT_COL[market_key], line)

                    entries.append(
                        {
                            # Identificacao
                            "player": player_name,
                            "player_name": player_name,
                            "team": team_abbr,
                            "opponent": opp_abbr,
                            "game_time": "",
                            # Mercado
                            "market": MARKET_LABELS.get(market_key, market_key),
                            "market_key": market_key,
                            "market_label": MARKET_LABELS.get(market_key, market_key),
                            "line": line,
                            "direction": direction,
                            # Odds
                            "odd_decimal": odd,
                            "odd_implied_prob": round(implied_probability(odd), 4),
                            "bookmaker": rng.choice(["draftkings", "fanduel", "bet365"]),
                            "all_odds": [],
                            # EV
                            "true_probability": round(true_prob, 4),
                            "ev_percent": round(ev_pct, 2),
                            "kelly_fraction": round(kelly, 4),
                            "classification": classif,
                            # Stats derivadas
                            "avg_stat_last10": round(avg_val, 2),
                            "games_over_line_pct": round(hit_rate, 3),
                            "last5_values": last5,
                            # Contexto
                            "def_rating_opponent": _NEUTRAL_MATCHUP["def_rating"],
                            "pace": _NEUTRAL_MATCHUP["pace"],
                            "dvp_rank": _NEUTRAL_MATCHUP["dvp_rank"],
                            "dvp_total": _NEUTRAL_MATCHUP["dvp_total"],
                            "minutes_avg": round(pstats.get("minutes_avg", 0.0), 1),
                            "projected_min": None,
                            "min_boost_pct": 0.0,
                            "team_injuries": [],
                            "line_movement": 0.0,
                            "line_opened": line,
                        }
                    )

    entries.sort(key=lambda e: e["ev_percent"], reverse=True)
    log.info("[demo] %d props sinteticas para %d jogos", len(entries), len(nba_games))
    return entries
