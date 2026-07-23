"""Funções puras de parsing de stats — sem I/O, sem DB, testáveis isoladamente.

Extraídas de stats.py (atual). Operam sobre DataFrames já carregados,
vindos do data warehouse (player_game_logs) ou da ESPN API.
"""

from __future__ import annotations

import logging
import re
import unicodedata
from typing import Any

import pandas as pd

from app.core.config import get_settings

log = logging.getLogger(__name__)


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


# ── helpers de parsing ESPN ───────────────────────────────────────────────────


def _normalize_name(name: str) -> str:
    """Normaliza nome de jogador para lookup sem acentos/pontuação.

    Exemplos: "LeBron James" -> "lebronjames", "T.J. Warren" -> "tjwarren"
    Segue a mesma lógica de stats.py raiz (preservar compatibilidade).
    """
    if not name:
        return ""
    decomposed = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in decomposed if not unicodedata.combining(c))
    name = re.sub(r"[\.\,\'\-]", "", name)
    name = re.sub(r"\s+(jr|sr|ii|iii|iv)\.?$", "", name, flags=re.IGNORECASE)
    return "".join(c.lower() for c in name if c.isalnum())


def _parse_event_date(date_str: Any) -> str:
    """Converte string de data ESPN para formato ISO 'YYYY-MM-DD'.

    ESPN retorna datas como "20240115" (8 dígitos) ou já no formato
    "2024-01-15". Qualquer valor inválido ou vazio retorna "".
    """
    if not date_str or not isinstance(date_str, str):
        return ""
    s = date_str.strip()
    # Já no formato ISO
    if len(s) >= 10 and s[4] == "-":
        return s[:10]
    # Formato compacto: "20240115" -> "2024-01-15"
    if len(s) == 8 and s.isdigit():
        return f"{s[:4]}-{s[4:6]}-{s[6:8]}"
    # Qualquer string com pelo menos 10 chars: pega os 10 primeiros
    if len(s) >= 10:
        return s[:10]
    return ""


def _parse_made_attempted(s: Any) -> tuple[int, int]:
    """Converte string "made-attempted" para tupla (made, attempted).

    Exemplos: "5-10" -> (5, 10), "" -> (0, 0), None -> (0, 0).
    """
    if not s or not isinstance(s, str):
        return (0, 0)
    m = re.match(r"^\s*(\d+)\s*-\s*(\d+)\s*$", s.strip())
    if m:
        return (int(m.group(1)), int(m.group(2)))
    # Tenta interpretar como inteiro simples (ex: "5" sem denominador)
    try:
        v = int(float(s))
        return (v, v)
    except Exception:
        return (0, 0)


# Colunas calculadas (combos)
_COMBO_DEFS: list[tuple[str, list[str]]] = [
    ("PRA", ["PTS", "REB", "AST"]),
    ("PR", ["PTS", "REB"]),
    ("PA", ["PTS", "AST"]),
    ("RA", ["REB", "AST"]),
    ("STOCKS", ["BLK", "STL"]),
]


def _add_combo_cols(df: pd.DataFrame) -> None:
    for combo, src_cols in _COMBO_DEFS:
        if all(c in df.columns for c in src_cols):
            numeric = df[src_cols].apply(pd.to_numeric, errors="coerce").fillna(0)
            df[combo] = numeric.sum(axis=1)


def _safe_int(v: Any) -> int:
    try:
        return int(float(v))
    except Exception:
        return 0


def _safe_float(v: Any) -> float:
    try:
        return float(v)
    except Exception:
        return 0.0


def _parse_game_rows(items: list, player_id: str, events_meta: dict) -> list[dict]:
    """Extrai linhas de gamelog do endpoint ESPN de atleta.

    Parâmetros
    ----------
    items:
        Lista de dicts vindos de data["categories"][i]["events"] — cada item
        tem "eventId" e "stats" (lista posicional de valores).
    player_id:
        ESPN athlete ID (usado apenas para logging).
    events_meta:
        Dict keyed por eventId com metadados do jogo (atVs, opponent, date…).
        Corresponde a data["events"] no JSON retornado pela ESPN.

    Retorna
    -------
    Lista de dicts com colunas:
        Date, HomeAway, Opp, MIN, PTS, REB, AST, FG3M, BLK, STL,
        TOV, FGM, FGA, FG3A, FTM, FTA, OREB, DREB, PF, PLUS_MINUS,
        PRA, PR, PA, RA, STOCKS
    """
    # Índices posicionais esperados pelo endpoint de gamelog ESPN v3
    # (web.api.espn.com/apis/common/v3 — ordem do campo "labels")
    # A ordem pode variar; usamos o dict events_meta para data e contexto.
    rows: list[dict] = []

    for ev in items:
        if not isinstance(ev, dict):
            continue

        stats_arr = ev.get("stats")
        if not stats_arr:
            continue

        ev_id = str(ev.get("eventId", ""))
        meta = events_meta.get(ev_id, {}) if events_meta else {}

        # Home/Away
        ha_raw = meta.get("atVs", "") or ev.get("homeAway", "") or ev.get("atVs", "") or ""
        if ha_raw == "@":
            ha_raw = "away"
        elif ha_raw == "vs":
            ha_raw = "home"

        # Oponente
        opp_abbr = (meta.get("opponent") or {}).get("abbreviation", "")

        # Data — tenta campos de metadados depois fallback em ev
        date_val = (
            _parse_event_date(meta.get("gameDate"))
            or _parse_event_date(meta.get("date"))
            or _parse_event_date(ev.get("gameDate"))
            or _parse_event_date(ev.get("date"))
            or ""
        )

        # Extrai stats posicionais de forma defensiva
        # arr=stats_arr vincula o valor atual da iteracao (evita B023)
        def _g(idx: int, arr=stats_arr) -> Any:
            try:
                return arr[idx]
            except (IndexError, TypeError):
                return None

        # Layout típico do endpoint ESPN v3 gamelog (labels confirmados empiricamente)
        # MIN=0, FGM=1, FGA=2, FG%=3, 3PM=4, 3PA=5, 3P%=6,
        # FTM=7, FTA=8, FT%=9, OREB=10, DREB=11, REB=12,
        # AST=13, STL=14, BLK=15, TOV=16, PF=17, PTS=18, +/-=19
        # Se o array tiver tamanho diferente, os _safe_* retornam 0.

        min_val = _safe_float(_g(0))
        fgm = _safe_int(_g(1))
        fga = _safe_int(_g(2))
        fg3m_raw = _g(4)
        fg3a = _safe_int(_g(5))
        ftm = _safe_int(_g(7))
        fta = _safe_int(_g(8))
        oreb = _safe_int(_g(10))
        dreb = _safe_int(_g(11))
        reb = _safe_int(_g(12))
        ast = _safe_int(_g(13))
        stl = _safe_int(_g(14))
        blk = _safe_int(_g(15))
        tov = _safe_int(_g(16))
        pf = _safe_int(_g(17))
        pts = _safe_int(_g(18))
        plus_minus = _safe_int(_g(19)) if len(stats_arr) > 19 else 0

        # FG3M pode vir como "5-10" ou simplesmente "5"
        if isinstance(fg3m_raw, str) and "-" in fg3m_raw:
            fg3m, _ = _parse_made_attempted(fg3m_raw)
        else:
            fg3m = _safe_int(fg3m_raw)

        row: dict[str, Any] = {
            "Date": date_val,
            "HomeAway": ha_raw,
            "Opp": opp_abbr,
            "MIN": min_val,
            "PTS": pts,
            "REB": reb,
            "AST": ast,
            "FG3M": fg3m,
            "BLK": blk,
            "STL": stl,
            "TOV": tov,
            "FGM": fgm,
            "FGA": fga,
            "FG3A": fg3a,
            "FTM": ftm,
            "FTA": fta,
            "OREB": oreb,
            "DREB": dreb,
            "PF": pf,
            "PLUS_MINUS": plus_minus,
            # Combos calculados inline
            "PRA": pts + reb + ast,
            "PR": pts + reb,
            "PA": pts + ast,
            "RA": reb + ast,
            "STOCKS": blk + stl,
        }
        rows.append(row)

    return rows


def _events_meta_from_raw(raw_data: dict) -> dict:
    """Extrai o dict de metadados de eventos (keyed por eventId) de um gamelog ESPN."""
    events_meta: dict = {}
    raw_events = raw_data.get("events")
    if isinstance(raw_events, dict):
        return raw_events
    if isinstance(raw_events, list):
        for e in raw_events:
            if isinstance(e, dict) and e.get("eventId"):
                events_meta[str(e["eventId"])] = e
    return events_meta


def _playoff_rows_from_raw(raw_data: dict) -> list[dict]:
    """Extrai linhas de jogos de playoff de UM gamelog ESPN (com 'seasonTypes' no topo)."""
    if not raw_data:
        return []
    events_meta = _events_meta_from_raw(raw_data)
    rows: list[dict] = []
    for season_type in raw_data.get("seasonTypes", []):
        display = str(season_type.get("displayName", ""))
        if not any(x in display for x in ("Playoff", "Post Season", "Postseason")):
            continue
        for cat in season_type.get("categories", []):
            if cat.get("type") != "event":
                continue
            rows.extend(_parse_game_rows(cat.get("events", []), player_id="", events_meta=events_meta))
    return rows


def extract_playoff_history(raw: dict, max_seasons: int = 3) -> dict:
    """Agrega playoffs de temporadas anteriores a partir do gamelog ESPN.

    Aceita dois shapes:
      - multi-season: {"seasons": [{"year": int, "data": {...}}, ...]}
        (retorno de fetch_player_gamelog com n_seasons > 1)
      - single: um gamelog com "seasonTypes" no topo (n_seasons == 1)

    Retorna {seasons: [anos], games_count, avg_pts, avg_reb, avg_ast},
    espelhando get_player_playoff_history() do legado.
    """
    empty = {"seasons": [], "games_count": 0, "avg_pts": 0.0, "avg_reb": 0.0, "avg_ast": 0.0}
    if not raw:
        return empty

    if isinstance(raw.get("seasons"), list):
        season_blobs = [(s.get("year"), s.get("data")) for s in raw["seasons"] if s.get("data")]
    elif raw.get("seasonTypes"):
        season_blobs = [(None, raw)]
    else:
        return empty

    all_po_rows: list[dict] = []
    years: list = []
    for year, data in season_blobs[:max_seasons]:
        rows = _playoff_rows_from_raw(data)
        if rows:
            all_po_rows.extend(rows)
            if year is not None and year not in years:
                years.append(year)

    if not all_po_rows:
        return empty

    df = pd.DataFrame(all_po_rows)

    def _m(col: str) -> float:
        if col not in df.columns:
            return 0.0
        s = pd.to_numeric(df[col], errors="coerce").dropna()
        return round(float(s.mean()), 1) if not s.empty else 0.0

    return {
        "seasons": [str(y) for y in years],
        "games_count": len(all_po_rows),
        "avg_pts": _m("PTS"),
        "avg_reb": _m("REB"),
        "avg_ast": _m("AST"),
    }


def _empty_stats() -> dict[str, Any]:
    """Contrato de stats zerado — jogador sem dados (fonte ESPN ou DW)."""
    return {
        "avg_pts": 0.0,
        "avg_reb": 0.0,
        "avg_ast": 0.0,
        "avg_3pm": 0.0,
        "avg_blk": 0.0,
        "avg_stl": 0.0,
        "avg_pra": 0.0,
        "avg_pr": 0.0,
        "avg_pa": 0.0,
        "avg_ra": 0.0,
        "avg_stocks": 0.0,
        "std_pts": 0.0,
        "std_reb": 0.0,
        "std_ast": 0.0,
        "std_3pm": 0.0,
        "std_blk": 0.0,
        "std_stl": 0.0,
        "std_pra": 0.0,
        "std_pr": 0.0,
        "std_pa": 0.0,
        "std_ra": 0.0,
        "std_stocks": 0.0,
        "last_5_pts": [],
        "minutes_avg": 0.0,
        "games_played": 0,
        "df": None,
        "is_playoffs": False,
        "playoff_games": 0,
        "season_avg_pts": 0.0,
        "season_avg_reb": 0.0,
        "season_avg_ast": 0.0,
        "season_avg_3pm": 0.0,
        "season_avg_blk": 0.0,
        "season_avg_stl": 0.0,
        "season_avg_pra": 0.0,
        "season_avg_pr": 0.0,
        "season_avg_pa": 0.0,
        "season_avg_ra": 0.0,
        "season_avg_stocks": 0.0,
        "season_games": 0,
        "team_abbr": "",
        # Campos extras exigidos pela tarefa
        "games_home": 0,
        "games_away": 0,
        "avg_pts_home": 0.0,
        "avg_pts_away": 0.0,
        "avg_reb_home": 0.0,
        "avg_reb_away": 0.0,
        "avg_ast_home": 0.0,
        "avg_ast_away": 0.0,
        "fg_pct": 0.0,
        "ft_pct": 0.0,
        "fg3_pct": 0.0,
        "avg_tov": 0.0,
        "avg_plus_minus": 0.0,
        "oreb_avg": 0.0,
        "dreb_avg": 0.0,
    }


def stats_from_rows(
    all_regular_rows: list[dict],
    all_playoff_rows: list[dict],
    n_games: int = 20,
    team_abbr: str = "",
) -> dict[str, Any]:
    """Constrói o dict de stats a partir de rows normalizados (chaves MAIÚSCULAS).

    Source-agnostic: serve tanto o parse da ESPN (build_player_stats) quanto a
    leitura do data warehouse (services/warehouse.py). A matemática de EV é
    idêntica — só muda a origem das rows.
    """
    if not all_regular_rows and not all_playoff_rows:
        return _empty_stats()

    # ── Ordena cronologicamente ───────────────────────────────────────────
    all_regular_rows.sort(key=lambda r: r.get("Date", "") or "")
    all_playoff_rows.sort(key=lambda r: r.get("Date", "") or "")

    in_playoffs = len(all_playoff_rows) > 0

    # ── Médias da temporada completa (âncora) ─────────────────────────────
    season_df = pd.DataFrame(all_regular_rows) if all_regular_rows else pd.DataFrame()
    if not season_df.empty:
        _add_combo_cols(season_df)

    def _season_mean(col: str) -> float:
        if season_df.empty or col not in season_df.columns:
            return 0.0
        s = pd.to_numeric(season_df[col], errors="coerce").dropna()
        return float(s.mean()) if not s.empty else 0.0

    season_avgs = {
        "season_avg_pts": _season_mean("PTS"),
        "season_avg_reb": _season_mean("REB"),
        "season_avg_ast": _season_mean("AST"),
        "season_avg_3pm": _season_mean("FG3M"),
        "season_avg_blk": _season_mean("BLK"),
        "season_avg_stl": _season_mean("STL"),
        "season_avg_pra": _season_mean("PRA"),
        "season_avg_pr": _season_mean("PR"),
        "season_avg_pa": _season_mean("PA"),
        "season_avg_ra": _season_mean("RA"),
        "season_avg_stocks": _season_mean("STOCKS"),
        "season_games": len(season_df),
    }

    # ── Filtro de minutos baixos (load management) ────────────────────────
    cfg = get_settings()
    season_min_avg = _season_mean("MIN")
    min_threshold = season_min_avg * cfg.min_minutes_fraction
    if season_min_avg > 0:
        filtered_reg = [r for r in all_regular_rows if r.get("MIN", 0.0) >= min_threshold]
    else:
        filtered_reg = list(all_regular_rows)

    # Remove tail de regular season (load management final de temporada)
    tail = cfg.regular_season_skip_tail
    clean_reg = filtered_reg[:-tail] if len(filtered_reg) > tail else []

    # ── Monta lookback: playoffs > regular filtrada ───────────────────────
    lookback = list(all_playoff_rows)
    if len(lookback) < n_games:
        fill = n_games - len(lookback)
        lookback = clean_reg[-fill:] + lookback

    lookback = lookback[-n_games:]
    lookback.sort(key=lambda r: r.get("Date", "") or "")

    # Rótulo sequencial se não há datas
    if not any(r.get("Date") for r in lookback):
        for i, r in enumerate(lookback):
            r["Date"] = f"G{i + 1}"

    df = pd.DataFrame(lookback)
    _add_combo_cols(df)

    # ── Helpers de média/desvio ───────────────────────────────────────────
    def _mean(col: str) -> float:
        if col not in df.columns:
            return 0.0
        s = pd.to_numeric(df[col], errors="coerce").dropna()
        return float(s.mean()) if not s.empty else 0.0

    def _std(col: str) -> float:
        if col not in df.columns:
            return 0.0
        s = pd.to_numeric(df[col], errors="coerce").dropna()
        return float(s.std()) if len(s) > 1 else 0.0

    last5_pts = pd.to_numeric(df["PTS"], errors="coerce").dropna().tail(5).tolist() if "PTS" in df.columns else []

    # ── Splits home/away ─────────────────────────────────────────────────
    def _split_mean(col: str, loc: str) -> float:
        if "HomeAway" not in df.columns or col not in df.columns:
            return 0.0
        sub = df[df["HomeAway"] == loc]
        if sub.empty:
            return 0.0
        s = pd.to_numeric(sub[col], errors="coerce").dropna()
        return float(s.mean()) if not s.empty else 0.0

    games_home = int((df["HomeAway"] == "home").sum()) if "HomeAway" in df.columns else 0
    games_away = int((df["HomeAway"] == "away").sum()) if "HomeAway" in df.columns else 0

    # ── Porcentagens de arremesso ─────────────────────────────────────────
    def _pct(made_col: str, att_col: str) -> float:
        if made_col not in df.columns or att_col not in df.columns:
            return 0.0
        made = pd.to_numeric(df[made_col], errors="coerce").fillna(0).sum()
        att = pd.to_numeric(df[att_col], errors="coerce").fillna(0).sum()
        return round(float(made / att), 4) if att > 0 else 0.0

    # ── Monta resultado final ─────────────────────────────────────────────
    result: dict[str, Any] = {
        "avg_pts": _mean("PTS"),
        "avg_reb": _mean("REB"),
        "avg_ast": _mean("AST"),
        "avg_3pm": _mean("FG3M"),
        "avg_blk": _mean("BLK"),
        "avg_stl": _mean("STL"),
        "avg_pra": _mean("PRA"),
        "avg_pr": _mean("PR"),
        "avg_pa": _mean("PA"),
        "avg_ra": _mean("RA"),
        "avg_stocks": _mean("STOCKS"),
        "avg_tov": _mean("TOV"),
        "avg_plus_minus": _mean("PLUS_MINUS"),
        "oreb_avg": _mean("OREB"),
        "dreb_avg": _mean("DREB"),
        "std_pts": _std("PTS"),
        "std_reb": _std("REB"),
        "std_ast": _std("AST"),
        "std_3pm": _std("FG3M"),
        "std_blk": _std("BLK"),
        "std_stl": _std("STL"),
        "std_pra": _std("PRA"),
        "std_pr": _std("PR"),
        "std_pa": _std("PA"),
        "std_ra": _std("RA"),
        "std_stocks": _std("STOCKS"),
        "last_5_pts": last5_pts,
        "minutes_avg": _mean("MIN"),
        "games_played": len(df),
        "df": df,
        "is_playoffs": in_playoffs,
        "playoff_games": len(all_playoff_rows),
        "team_abbr": team_abbr,
        # Home/away splits
        "games_home": games_home,
        "games_away": games_away,
        "avg_pts_home": _split_mean("PTS", "home"),
        "avg_pts_away": _split_mean("PTS", "away"),
        "avg_reb_home": _split_mean("REB", "home"),
        "avg_reb_away": _split_mean("REB", "away"),
        "avg_ast_home": _split_mean("AST", "home"),
        "avg_ast_away": _split_mean("AST", "away"),
        # Porcentagens de arremesso
        "fg_pct": _pct("FGM", "FGA"),
        "ft_pct": _pct("FTM", "FTA"),
        "fg3_pct": _pct("FG3M", "FG3A"),
    }
    result.update(season_avgs)
    return result


def build_player_stats(raw_data: dict, n_games: int = 20) -> dict:
    """Constrói o dict de stats do jogador a partir do JSON bruto da ESPN.

    Espelha get_player_recent_stats() de stats.py, mas opera sobre o JSON
    já em memória (sem I/O). Retorna o mesmo contrato de campos para que
    ev.py / matchup.py / minutes.py funcionem sem alterações.

    Campos obrigatórios retornados
    --------------------------------
    games_played, avg_pts, avg_reb, avg_ast, avg_3pm, avg_pra, avg_pr,
    avg_pa, avg_ra, avg_stocks, minutes_avg, df (pd.DataFrame),
    games_home, games_away, avg_pts_home, avg_pts_away, avg_reb_home,
    avg_reb_away, avg_ast_home, avg_ast_away, fg_pct, ft_pct, fg3_pct,
    avg_blk, avg_stl, avg_tov, avg_plus_minus, oreb_avg, dreb_avg
    """
    empty = _empty_stats()

    if not raw_data:
        return empty

    # ── Extraia metadados de eventos ──────────────────────────────────────
    events_meta: dict = {}
    raw_events = raw_data.get("events")
    if isinstance(raw_events, dict):
        events_meta = raw_events
    elif isinstance(raw_events, list):
        for e in raw_events:
            if isinstance(e, dict) and e.get("eventId"):
                events_meta[str(e["eventId"])] = e

    # ── Percorre seasonTypes buscando regular season e playoffs ──────────
    all_regular_rows: list[dict] = []
    all_playoff_rows: list[dict] = []

    for season_type in raw_data.get("seasonTypes", []):
        display = str(season_type.get("displayName", ""))
        is_playoffs = any(x in display for x in ("Playoff", "Post Season", "Postseason"))
        is_regular = "Regular Season" in display

        if not is_regular and not is_playoffs:
            continue

        for cat in season_type.get("categories", []):
            if cat.get("type") != "event":
                continue
            items = cat.get("events", [])
            rows = _parse_game_rows(items, player_id="", events_meta=events_meta)
            if is_playoffs:
                all_playoff_rows.extend(rows)
            else:
                all_regular_rows.extend(rows)

    if not all_regular_rows and not all_playoff_rows:
        return empty

    team_abbr = (raw_data.get("athlete") or {}).get("team", {}).get("abbreviation", "") or ""
    return stats_from_rows(all_regular_rows, all_playoff_rows, n_games=n_games, team_abbr=team_abbr)
