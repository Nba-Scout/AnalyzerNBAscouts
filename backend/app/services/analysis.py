"""Servico de analise diaria — versao async de scout.analyze_day().

Divide o trabalho em tres fases:
  A) I/O paralelo por evento (Odds + rosters + lesoes + stats de time)
  B) I/O paralelo por jogador deduplicado (gamelogs ESPN)
  C) CPU puro sincrono (EV, Kelly, classificacao, montagem de entries)

Semaforos controlam a taxa de requisicoes:
  _SEM_ODDS  = 3 requisicoes paralelas para a Odds API
  _SEM_STATS = 10 requisicoes paralelas para a ESPN
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from datetime import datetime

from app.core.constants import MARKET_LABELS, MARKET_TO_STAT

log = logging.getLogger(__name__)

_SEM_ODDS = asyncio.Semaphore(3)
_SEM_STATS = asyncio.Semaphore(10)

# Mapa mercado → chave de media no dict de stats
_STAT_AVG_MAP: dict[str, str] = {
    "player_points": "avg_pts",
    "player_rebounds": "avg_reb",
    "player_assists": "avg_ast",
    "player_threes": "avg_3pm",
    "player_blocks": "avg_blk",
    "player_steals": "avg_stl",
    "player_points_rebounds_assists": "avg_pra",
    "player_points_rebounds": "avg_pr",
    "player_points_assists": "avg_pa",
    "player_rebounds_assists": "avg_ra",
    "player_blocks_steals": "avg_stocks",
}

# Mapa mercado → coluna do DataFrame de stats
_STAT_COL_MAP: dict[str, str] = MARKET_TO_STAT


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------


def _normalize(s: str) -> str:
    return s.lower().strip().replace(".", "").replace("-", " ")


async def _com_sem(fn, *args, sem: asyncio.Semaphore, **kwargs):
    """Executa `fn(*args, **kwargs)` dentro do Semaphore fornecido."""
    async with sem:
        return await fn(*args, **kwargs)


def _build_entry(
    *,
    prop: dict,
    player_name: str,
    team_abbr: str,
    opponent_abbr: str,
    game_time: str,
    player_stats: dict,
    matchup: dict,
    projected_min: float | None,
    min_boost_pct: float,
    player_injuries: list,
    line_movement: float,
    line_opened: float,
) -> dict:
    """Monta o dict de saida identico ao formato de scout.analyze_day().

    Campos mapeados 1-a-1 com AnalyzedProp (db/models/prop.py) mais os
    campos extras esperados pelo frontend (_format_entry em api.py):
    player_name, team, opponent, market_key, market_label, line, direction,
    odd_decimal, odd_implied_prob, bookmaker, all_odds, true_probability,
    ev_percent, kelly_fraction, classification, avg_stat_last10,
    games_over_line_pct, last5_values, def_rating_opponent, pace,
    minutes_avg, projected_min, min_boost_pct, dvp_rank, dvp_total,
    team_injuries, game_time, line_movement, line_opened.
    """
    from app.analytics.ev import (
        calculate_ev,
        classify_bet,
        estimate_true_probability,
        implied_probability,
        kelly_fraction,
    )
    from app.analytics.stats_parsing import games_over_line, get_last5_values

    market_key = prop["market"]  # campo market no dict de prop da Odds API
    line = prop["line"]
    direction = prop["direction"]
    odd_decimal = prop["odd_decimal"]
    bookmaker = prop["bookmaker"]
    all_odds = prop.get("all_odds", [])
    line_mv = prop.get("line_movement", line_movement)
    line_op = prop.get("line_opened", line_opened)

    _stat_col = _STAT_COL_MAP.get(market_key, "PTS")
    avg_val = player_stats.get(_STAT_AVG_MAP.get(market_key, "avg_pts"), 0.0)

    true_prob = estimate_true_probability(
        player_stats,
        line,
        direction,
        matchup,
        market_key,
        projected_minutes=projected_min,
    )
    ev_pct = calculate_ev(true_prob, odd_decimal)
    kelly = kelly_fraction(true_prob, odd_decimal)
    classif = classify_bet(ev_pct, true_prob)
    implied = implied_probability(odd_decimal)

    hit_rate = games_over_line(player_stats, line, _stat_col)
    last5 = get_last5_values(player_stats, _stat_col, line)

    return {
        # Identificacao
        "player": player_name,
        "player_name": player_name,  # alias para AnalyzedProp
        "team": team_abbr,
        "opponent": opponent_abbr,
        "game_time": game_time,
        # Mercado
        "market": MARKET_LABELS.get(market_key, market_key),
        "market_key": market_key,
        "market_label": MARKET_LABELS.get(market_key, market_key),
        "line": line,
        "direction": direction,
        # Odds
        "odd_decimal": round(odd_decimal, 3),
        "odd_implied_prob": round(implied, 4),
        "bookmaker": bookmaker,
        "all_odds": all_odds,
        # EV
        "true_probability": round(true_prob, 4),
        "ev_percent": round(ev_pct, 2),
        "kelly_fraction": round(kelly, 4),
        "classification": classif,
        # Stats derivadas
        "avg_stat_last10": round(avg_val, 2),
        "games_over_line_pct": round(hit_rate, 3),
        "last5_values": last5,
        # Contexto de matchup
        "def_rating_opponent": round(matchup.get("def_rating", 0.0), 2),
        "pace": round(matchup.get("pace", 0.0), 2),
        "dvp_rank": matchup.get("dvp_rank", 0),
        "dvp_total": matchup.get("dvp_total", 0),
        # Minutos
        "minutes_avg": round(player_stats.get("minutes_avg", 0.0), 1),
        "projected_min": round(projected_min, 1) if projected_min is not None else None,
        "min_boost_pct": min_boost_pct,
        # Lesoes
        "team_injuries": player_injuries,
        # Movimento de linha
        "line_movement": line_mv,
        "line_opened": line_op,
    }


# ---------------------------------------------------------------------------
# Logica principal
# ---------------------------------------------------------------------------


async def analyze_day(use_demo: bool = False) -> list[dict]:
    """Analisa as props do dia em tres fases async + CPU.

    Se use_demo=True (ou Odds API nao retornar props), delega para
    services.demo.generate_demo_entries e marca _demo=True.

    Retorna lista de entries ordenada por ev_percent desc.
    """
    if use_demo:
        from app.clients.nba_live import get_todays_games
        from app.services import demo as demo_svc

        nba_games = await get_todays_games()
        entries = await demo_svc.generate_demo_entries(nba_games)
        for e in entries:
            e["_demo"] = True
        return entries

    # -----------------------------------------------------------------------
    # FASE A: busca de eventos, props, rosters, lesoes e stats de time
    # -----------------------------------------------------------------------
    from app.clients.espn import fetch_team_injuries, fetch_team_stats
    from app.clients.nba_live import get_todays_games
    from app.clients.odds import fetch_events, fetch_props_for_game
    from app.core.teams import canonical_team_name
    from app.core.teams import team_abbr as get_team_abbr
    from app.services.players import get_team_roster

    log.info("Fase A: buscando jogos e eventos do dia...")
    nba_games, odds_events = await asyncio.gather(
        get_todays_games(),
        fetch_events(),
    )

    log.info("NBA API: %d jogos | Odds API: %d eventos", len(nba_games), len(odds_events))

    if not odds_events:
        log.warning("Odds API sem eventos — ativando modo demo")
        from app.services import demo as demo_svc

        entries = await demo_svc.generate_demo_entries(nba_games)
        for e in entries:
            e["_demo"] = True
        return entries

    # Cria estrutura de eventos enriquecida (casa + visitante canonicos)
    events_info: list[dict] = []
    for ev_evt in odds_events:
        home_canon = canonical_team_name(ev_evt.get("home_team", ""))
        away_canon = canonical_team_name(ev_evt.get("away_team", ""))
        home_abbr = get_team_abbr(home_canon)
        away_abbr = get_team_abbr(away_canon)
        events_info.append(
            {
                "event_id": ev_evt["event_id"],
                "home_team": home_canon,
                "away_team": away_canon,
                "home_abbr": home_abbr,
                "away_abbr": away_abbr,
                "commence_time": ev_evt.get("commence_time", ""),
            }
        )

    async def _fetch_event_data(ev_info: dict) -> dict:
        """Busca em paralelo: props + rosters + lesoes + stats para um evento."""
        eid = ev_info["event_id"]
        h_abbr = ev_info["home_abbr"]
        a_abbr = ev_info["away_abbr"]

        (
            props,
            home_roster,
            away_roster,
            home_inj,
            away_inj,
            home_stats,
            away_stats,
        ) = await asyncio.gather(
            _com_sem(fetch_props_for_game, eid, sem=_SEM_ODDS),
            get_team_roster(h_abbr),
            get_team_roster(a_abbr),
            fetch_team_injuries(h_abbr),
            fetch_team_injuries(a_abbr),
            fetch_team_stats(h_abbr),
            fetch_team_stats(a_abbr),
        )
        return {
            **ev_info,
            "props": props or [],
            "home_roster": home_roster or {},
            "away_roster": away_roster or {},
            "home_inj": home_inj or [],
            "away_inj": away_inj or [],
            "home_stats": home_stats or {},
            "away_stats": away_stats or {},
        }

    events_data = await asyncio.gather(*[_fetch_event_data(ev) for ev in events_info])

    # Verifica se algum jogo retornou props
    games_with_props = sum(1 for ev in events_data if ev["props"])
    if games_with_props == 0 and nba_games:
        log.warning("Odds API nao retornou props — ativando modo demo")
        from app.services import demo as demo_svc

        entries = await demo_svc.generate_demo_entries(nba_games)
        for e in entries:
            e["_demo"] = True
        return entries

    # -----------------------------------------------------------------------
    # FASE B: busca de stats por jogador (dedup por player_id)
    # -----------------------------------------------------------------------
    log.info("Fase B: coletando stats de jogadores...")
    from app.analytics.stats_parsing import _normalize_name, build_player_stats
    from app.clients.espn import fetch_player_gamelog

    # Coleta player_ids unicos de todos os rosters
    all_player_ids: set[str] = set()
    for ev in events_data:
        all_player_ids.update(ev["home_roster"].keys())
        all_player_ids.update(ev["away_roster"].keys())

    log.info("Fase B: %d jogadores unicos para buscar stats", len(all_player_ids))

    async def _fetch_stats(pid: str) -> tuple[str, dict | None]:
        async with _SEM_STATS:
            try:
                raw = await fetch_player_gamelog(pid)
                if not raw:
                    return pid, None
                stats = build_player_stats(raw)
                return pid, stats
            except Exception as exc:
                log.debug("Stats falhou para player_id=%s: %s", pid, exc)
                return pid, None

    stats_results = await asyncio.gather(*[_fetch_stats(pid) for pid in all_player_ids])
    player_stats_map: dict[str, dict] = {pid: s for pid, s in stats_results if s is not None}
    log.info("Fase B: stats obtidas para %d/%d jogadores", len(player_stats_map), len(all_player_ids))

    # -----------------------------------------------------------------------
    # FASE C: calculo CPU-puro para cada prop
    # -----------------------------------------------------------------------
    log.info("Fase C: calculando EV e montando entries...")
    from app.analytics.matchup import compute_matchup
    from app.analytics.minutes import compute_freed_minutes, compute_projected_minutes

    entries: list[dict] = []

    for ev in events_data:
        if not ev["props"]:
            continue

        home_abbr = ev["home_abbr"]
        away_abbr = ev["away_abbr"]
        home_roster = ev["home_roster"]
        away_roster = ev["away_roster"]
        home_inj = ev["home_inj"]
        away_inj = ev["away_inj"]
        home_stats = ev["home_stats"]
        away_stats = ev["away_stats"]

        commence_time = ev["commence_time"]
        game_time = _format_game_time(commence_time)

        # Pre-computa matchup para cada lado
        home_matchup = compute_matchup(home_stats)
        away_matchup = compute_matchup(away_stats)

        # Pre-computa minutos liberados por desfalques
        home_freed = compute_freed_minutes(home_inj, player_stats_map)
        away_freed = compute_freed_minutes(away_inj, player_stats_map)

        # Indice de nome normalizado → player_id (para match prop → jogador)
        # Junta home e away roster
        name_to_pid: dict[str, str] = {}
        for pid, pname in {**home_roster, **away_roster}.items():
            norm = _normalize(pname) if pname else ""
            if norm:
                name_to_pid[norm] = pid

        # Tambem indexa por _normalize_name do stats_parsing (pode diferir levemente)
        try:
            for pid, pname in {**home_roster, **away_roster}.items():
                if pname:
                    name_to_pid[_normalize_name(pname)] = pid
        except Exception:
            pass

        for prop in ev["props"]:
            prop_player_name = prop.get("player_name", "")
            if not prop_player_name:
                continue

            # Resolucao do jogador: nome normalizado
            norm_prop_name = _normalize(prop_player_name)
            pid = name_to_pid.get(norm_prop_name)

            if pid is None:
                # Tentativa com _normalize_name do stats_parsing
                with contextlib.suppress(Exception):
                    pid = name_to_pid.get(_normalize_name(prop_player_name))

            if pid is None:
                log.debug("Jogador nao encontrado no roster: %s", prop_player_name)
                continue

            pstats = player_stats_map.get(pid)
            if pstats is None or pstats.get("games_played", 0) == 0:
                log.debug("Sem stats para %s (pid=%s)", prop_player_name, pid)
                continue

            # Determina time e oponente do jogador
            if pid in home_roster:
                player_team_abbr = home_abbr
                opp_abbr = away_abbr
                opp_matchup = away_matchup  # defesa do oponente
                freed_min = home_freed
                player_injuries = home_inj
            else:
                player_team_abbr = away_abbr
                opp_abbr = home_abbr
                opp_matchup = home_matchup
                freed_min = away_freed
                player_injuries = away_inj

            # Cascata de minutos
            player_avg_min = pstats.get("minutes_avg", 0.0)
            projected_min = compute_projected_minutes(player_avg_min, freed_min)

            min_boost_pct = (
                round((projected_min / player_avg_min - 1.0) * 100, 1)
                if projected_min is not None and player_avg_min > 0
                else 0.0
            )

            try:
                entry = _build_entry(
                    prop=prop,
                    player_name=prop_player_name,
                    team_abbr=player_team_abbr,
                    opponent_abbr=opp_abbr,
                    game_time=game_time,
                    player_stats=pstats,
                    matchup=opp_matchup,
                    projected_min=projected_min,
                    min_boost_pct=min_boost_pct,
                    player_injuries=player_injuries,
                    line_movement=prop.get("line_movement", 0.0),
                    line_opened=prop.get("line_opened", prop.get("line", 0.0)),
                )
                entries.append(entry)
            except Exception as exc:
                log.warning(
                    "Erro ao montar entry para %s / %s: %s",
                    prop_player_name,
                    prop.get("market"),
                    exc,
                )

    entries.sort(key=lambda e: e["ev_percent"], reverse=True)
    log.info("Fase C: %d entries geradas", len(entries))
    return entries


def _format_game_time(iso: str) -> str:
    """Formata ISO timestamp para 'HH:MM UTC'."""
    if not iso:
        return ""
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.strftime("%H:%M UTC")
    except Exception:
        return iso
