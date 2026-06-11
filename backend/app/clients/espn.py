"""Cliente ESPN async.

Preserva as URLs exatas usadas em stats.py (legado sincrono) e delega
todas as requisicoes HTTP para app.clients.base.request_json (httpx +
retry/backoff).

Parsing de dados de gamelog fica em analytics/stats_parsing.py; este
modulo apenas busca e retorna o JSON cru.
"""

from __future__ import annotations

import contextlib
import logging

from app.clients.base import request_json
from app.core.config import get_settings

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# URLs base — copiadas de stats.py / config.py
# ---------------------------------------------------------------------------
ESPN_SITE_BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba"
ESPN_STATS_BASE = "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba"
_ESPN_CORE_BASE = "https://sports.core.api.espn.com/v3/sports/basketball/nba"
_ESPN_CORE_V2_BASE = "https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba"
_ESPN_TEAM_STATS_TPL = (
    "https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/{season}/types/2/teams/{team}/statistics"
)
_ESPN_STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?level=3"

# status HTTP que nao devem ser re-tentados na ESPN
_NO_RETRY = (401, 403, 404, 422)


def _espn_season_year() -> int:
    """Ano de termino da temporada atual (ex: 2025 para a temporada 2024-25)."""
    cfg = get_settings()
    season = cfg.nba_season  # ex: "2024-25"
    try:
        return int(season.split("-")[0]) + 1
    except Exception:
        from datetime import date

        today = date.today()
        return today.year if today.month >= 10 else today.year


# ---------------------------------------------------------------------------
# fetch_player_index
# ---------------------------------------------------------------------------
async def fetch_player_index() -> dict:
    """Retorna {normalized_player_name: espn_player_id} de todos os atletas ativos.

    Normaliza o nome igual ao legado (_normalize_name em stats.py) para
    manter compatibilidade com o restante do codigo.
    """
    import re
    import unicodedata

    def _normalize(name: str) -> str:
        if not name:
            return ""
        decomposed = unicodedata.normalize("NFKD", name)
        name = "".join(c for c in decomposed if not unicodedata.combining(c))
        name = re.sub(r"[\.\,\'\-]", "", name)
        name = re.sub(r"\s+(jr|sr|ii|iii|iv)\.?$", "", name, flags=re.IGNORECASE)
        return "".join(c.lower() for c in name if c.isalnum())

    url = f"{_ESPN_CORE_BASE}/athletes"
    data = await request_json(url, params={"limit": 2000, "active": "true"}, no_retry_statuses=_NO_RETRY)
    if not data:
        log.warning("fetch_player_index: ESPN nao retornou dados")
        return {}

    index: dict = {}
    for p in data.get("items", []):
        if not isinstance(p, dict):
            continue
        pid = p.get("id")
        name = p.get("displayName") or p.get("fullName") or ""
        if not pid or not name:
            continue
        norm = _normalize(name)
        if norm and norm not in index:
            index[norm] = str(pid)

    log.info("fetch_player_index: %d jogadores carregados", len(index))
    return index


# ---------------------------------------------------------------------------
# fetch_player_gamelog
# ---------------------------------------------------------------------------
async def fetch_player_gamelog(player_id: str, n_seasons: int = 1) -> dict | None:
    """Retorna o JSON cru do endpoint de gamelog ESPN para o jogador.

    Quando n_seasons > 1 busca temporadas anteriores e devolve dicionario
    com chave 'seasons' listando cada resposta bruta.

    O parsing do JSON (labels, stats, datas) fica em analytics/stats_parsing.py.
    """
    if not player_id:
        return None

    get_settings()
    current_year = _espn_season_year()

    if n_seasons == 1:
        url = f"{ESPN_STATS_BASE}/athletes/{player_id}/gamelog"
        return await request_json(url, no_retry_statuses=_NO_RETRY)

    results: dict = {"player_id": player_id, "seasons": []}
    for offset in range(n_seasons):
        year = current_year - offset
        url = f"{ESPN_STATS_BASE}/athletes/{player_id}/gamelog"
        params = {} if offset == 0 else {"season": str(year)}
        data = await request_json(url, params=params, no_retry_statuses=_NO_RETRY)
        if data:
            results["seasons"].append({"year": year, "data": data})

    return results if results["seasons"] else None


# ---------------------------------------------------------------------------
# fetch_team_roster
# ---------------------------------------------------------------------------
async def fetch_team_roster(team_abbr: str) -> dict:
    """Retorna {player_id: display_name} do elenco atual do time.

    Usa o endpoint ESPN de roster: /teams/{abbr}/roster
    Mesmo endpoint que o legado get_team_roster em stats.py.
    """
    if not team_abbr:
        return {}

    url = f"{ESPN_SITE_BASE}/teams/{team_abbr.lower()}/roster"
    data = await request_json(url, no_retry_statuses=_NO_RETRY)
    if not data:
        log.warning("fetch_team_roster: sem dados para %s", team_abbr)
        return {}

    roster: dict = {}
    for athlete in data.get("athletes") or []:
        pid = str(athlete.get("id", ""))
        name = athlete.get("displayName") or athlete.get("fullName") or ""
        if pid:
            roster[pid] = name

    log.info("fetch_team_roster %s: %d jogadores", team_abbr.upper(), len(roster))
    return roster


# ---------------------------------------------------------------------------
# fetch_team_injuries
# ---------------------------------------------------------------------------
async def fetch_team_injuries(team_abbr: str) -> list:
    """Retorna lista de {name, status, player_id} para jogadores lesionados.

    Status possiveis: 'Out', 'Questionable', 'Probable', 'Day-To-Day'.
    Mesmo endpoint que get_team_injuries em stats.py.
    """
    if not team_abbr:
        return []

    url = f"{ESPN_SITE_BASE}/teams/{team_abbr.lower()}/roster"
    data = await request_json(url, no_retry_statuses=_NO_RETRY)
    if not data:
        return []

    injuries: list = []
    for athlete in data.get("athletes") or []:
        inj_list = athlete.get("injuries") or []
        if not inj_list:
            continue
        status = inj_list[0].get("status", "") if inj_list else ""
        if not status:
            continue
        name = athlete.get("displayName") or athlete.get("fullName") or ""
        pid = str(athlete.get("id", ""))
        injuries.append({"name": name, "status": status, "player_id": pid})

    return injuries


# ---------------------------------------------------------------------------
# fetch_team_stats  (uma equipe)
# ---------------------------------------------------------------------------
async def fetch_team_stats(team_abbr: str) -> dict | None:
    """Retorna stats defensivas do time (def_rating, pace, opp_pts_per_game).

    Requer a conversao team_abbr -> ESPN team ID; se nao conseguir mapear
    retorna None.
    """
    mapping = await _build_espn_team_id_map()
    espn_id = mapping.get(team_abbr.upper())
    if not espn_id:
        log.warning("fetch_team_stats: ESPN ID nao encontrado para %s", team_abbr)
        return None

    season = _espn_season_year()
    url = _ESPN_TEAM_STATS_TPL.format(season=season, team=espn_id)
    data = await request_json(url, no_retry_statuses=_NO_RETRY)
    if not data:
        return None

    return _extract_team_stats(espn_id, data, opp_pts=0.0)


# ---------------------------------------------------------------------------
# fetch_all_teams_stats
# ---------------------------------------------------------------------------
async def fetch_all_teams_stats() -> dict:
    """Retorna {team_abbr: {def_rating, pace, opp_pts_per_game}} para todos os times.

    Replica a logica de _load_league_team_stats do legado:
    1. Busca standings para obter opp_pts por equipe.
    2. Busca /statistics de cada equipe para obter pace.
    3. Calcula def_rating = (opp_pts * 100) / pace.
    """
    import asyncio as _aio

    mapping = await _build_espn_team_id_map()  # {ABBR: espn_id}
    if not mapping:
        log.warning("fetch_all_teams_stats: mapa de times vazio")
        return {}

    # --- standings: opp pts por espn_id ---
    standings_data = await request_json(_ESPN_STANDINGS_URL, no_retry_statuses=_NO_RETRY)
    espn_id_to_opp_pts: dict[str, float] = {}
    if standings_data:
        for child in standings_data.get("children", []):
            for entry in child.get("standings", {}).get("entries", []):
                team = entry.get("team", {})
                espn_tid = str(team.get("id", ""))
                for s in entry.get("stats", []):
                    n = s.get("name", "")
                    if n in ("avgPointsAgainst", "pointsAgainstPerGame", "avgPointsAllowed"):
                        with contextlib.suppress(Exception):
                            espn_id_to_opp_pts[espn_tid] = float(s.get("value", 0) or 0)

    season = _espn_season_year()
    get_settings()

    async def _fetch_one(abbr: str, espn_id: str) -> tuple[str, dict | None]:
        url = _ESPN_TEAM_STATS_TPL.format(season=season, team=espn_id)
        data = await request_json(url, no_retry_statuses=_NO_RETRY)
        if not data:
            return abbr, None
        opp_pts = espn_id_to_opp_pts.get(espn_id, 0.0)
        return abbr, _extract_team_stats(espn_id, data, opp_pts=opp_pts)

    tasks = [_fetch_one(abbr, eid) for abbr, eid in mapping.items()]
    results = await _aio.gather(*tasks)

    out: dict = {}
    for abbr, stats in results:
        if stats:
            out[abbr] = stats

    log.info("fetch_all_teams_stats: %d times carregados", len(out))
    return out


# ---------------------------------------------------------------------------
# fetch_player_team_abbr
# ---------------------------------------------------------------------------
async def fetch_player_team_abbr(player_id: str) -> str | None:
    """Retorna a abreviacao do time atual do jogador (ex: 'ORL').

    Usa o endpoint ESPN de atleta: /athletes/{player_id}.
    Mesmo endpoint que get_player_team_abbr em stats.py.
    """
    if not player_id:
        return None

    url = f"{ESPN_SITE_BASE}/athletes/{player_id}"
    data = await request_json(url, no_retry_statuses=_NO_RETRY)
    if not data:
        return None

    athlete = data.get("athlete") or {}
    abbr = (athlete.get("team") or {}).get("abbreviation", "") or ""
    return abbr or None


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------


async def _build_espn_team_id_map() -> dict:
    """Retorna {TEAM_ABBR_UPPER: espn_team_id_str}.

    Busca /teams no ESPN e cruza com nba_api.stats.static.teams para
    montar o mapa de abreviacoes -> ESPN ID.
    Replica a logica de _build_team_id_maps em stats.py.
    """
    import re
    import unicodedata

    def _normalize(name: str) -> str:
        if not name:
            return ""
        decomposed = unicodedata.normalize("NFKD", name)
        name = "".join(c for c in decomposed if not unicodedata.combining(c))
        name = re.sub(r"[\.\,\'\-]", "", name)
        return "".join(c.lower() for c in name if c.isalnum())

    # Mapa inverso via nba_api estatico (nao faz request HTTP)
    nba_static_by_norm: dict[str, str] = {}  # norm_name -> abbreviation
    try:
        from nba_api.stats.static import teams as _nba_teams  # type: ignore

        for t in _nba_teams.get_teams():
            abbr = t["abbreviation"]
            nba_static_by_norm[_normalize(t["full_name"])] = abbr
            nba_static_by_norm[_normalize(t["nickname"])] = abbr
    except Exception as exc:
        log.warning("_build_espn_team_id_map: nba_api indisponivel: %s", exc)

    data = await request_json(f"{ESPN_SITE_BASE}/teams", no_retry_statuses=_NO_RETRY)
    if not data:
        return {}

    mapping: dict = {}
    espn_teams: list[dict] = []
    for sport in data.get("sports", []):
        for league in sport.get("leagues", []):
            for tw in league.get("teams", []):
                t = tw.get("team", {})
                if t:
                    espn_teams.append(t)

    for et in espn_teams:
        name = et.get("displayName", "")
        nick = et.get("name", "")
        espn_id = str(et.get("id", ""))
        abbr_espn = et.get("abbreviation", "").upper()

        norm_full = _normalize(name)
        norm_nick = _normalize(nick)
        abbr = nba_static_by_norm.get(norm_full) or nba_static_by_norm.get(norm_nick) or abbr_espn or None
        if abbr and espn_id:
            mapping[abbr.upper()] = espn_id

    return mapping


def _extract_team_stats(espn_id: str, data: dict, *, opp_pts: float) -> dict:
    """Extrai pace do JSON de /statistics e calcula def_rating."""
    cfg = get_settings()
    pace: float = cfg.league_avg_pace

    for cat in data.get("splits", {}).get("categories", []):
        for s in cat.get("stats", []):
            if s.get("name") == "paceFactor":
                with contextlib.suppress(Exception):
                    pace = float(s.get("value", cfg.league_avg_pace))

    def_rating = opp_pts * 100.0 / pace if pace > 0 and opp_pts > 0 else cfg.league_avg_def_rating

    return {
        "def_rating": round(def_rating, 2),
        "pace": round(pace, 2),
        "opp_pts_per_game": round(opp_pts, 2),
    }
