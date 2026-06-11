"""Cliente Odds API async.

Baseado no legado odds.py (sincrono). Todas as requisicoes HTTP passam
por app.clients.base.request_json (httpx + retry/backoff).

Rastreia a cota da API via headers x-requests-remaining / x-requests-used
atraves do callback on_response passado para request_json.
"""

from __future__ import annotations

import contextlib
import logging
from datetime import UTC, datetime, timedelta

import httpx

from app.clients.base import request_json
from app.core.config import get_settings

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Estado de quota (modulo-level, compartilhado no processo)
# ---------------------------------------------------------------------------
_quota_state: dict = {"remaining": None, "used": None}


def get_quota_remaining() -> int | None:
    """Retorna o numero de requests restantes na cota da Odds API, ou None se desconhecido."""
    return _quota_state["remaining"]


def _on_response(r: httpx.Response) -> None:
    """Callback passado para request_json; captura headers de quota.

    Atualiza _quota_state em toda resposta recebida da Odds API.
    """
    remaining = r.headers.get("x-requests-remaining")
    used = r.headers.get("x-requests-used")
    if remaining is not None:
        with contextlib.suppress(ValueError):
            _quota_state["remaining"] = int(remaining)
    if used is not None:
        with contextlib.suppress(ValueError):
            _quota_state["used"] = int(used)
    log.debug(
        "OddsAPI quota: used=%s remaining=%s",
        _quota_state["used"],
        _quota_state["remaining"],
    )


# ---------------------------------------------------------------------------
# normalize_bookmaker_name — copia exata do legado odds.py
# ---------------------------------------------------------------------------
def normalize_bookmaker_name(name: str) -> str:
    """Normaliza o nome da casa de apostas para um identificador canonico."""
    if not name:
        return ""
    n = name.lower().replace("_", "").replace("-", "").replace(" ", "")
    if "bet365" in n:
        return "bet365"
    if "betfair" in n:
        return "betfair"
    if "pinnacle" in n:
        return "pinnacle"
    if "draftkings" in n:
        return "draftkings"
    if "fanduel" in n:
        return "fanduel"
    if "betonlineag" in n or "betonline" in n:
        return "betonlineag"
    return n


# ---------------------------------------------------------------------------
# fetch_events
# ---------------------------------------------------------------------------
async def fetch_events() -> list:
    """Retorna jogos das proximas 24 horas.

    Output: lista de dicts com event_id, home_team, away_team, commence_time.
    Replica a logica de get_todays_events() do legado odds.py.
    """
    cfg = get_settings()
    if not cfg.odds_api_key:
        log.error("fetch_events: ODDS_API_KEY nao configurada")
        return []

    url = f"{cfg.odds_api_base}/sports/{cfg.sport}/events"
    params = {
        "apiKey": cfg.odds_api_key,
        "dateFormat": "iso",
    }

    data = await request_json(
        url,
        params=params,
        on_response=_on_response,
        no_retry_statuses=(401, 422),
    )
    if not data:
        return []

    now = datetime.now(UTC)
    cutoff = now + timedelta(hours=24)
    events: list = []

    for ev in data:
        try:
            commence = datetime.fromisoformat(ev["commence_time"].replace("Z", "+00:00"))
            if now <= commence <= cutoff:
                events.append(
                    {
                        "event_id": ev["id"],
                        "home_team": ev.get("home_team", ""),
                        "away_team": ev.get("away_team", ""),
                        "commence_time": ev["commence_time"],
                    }
                )
        except Exception as exc:
            log.warning("fetch_events: evento malformado ignorado: %s", exc)

    return events


# ---------------------------------------------------------------------------
# fetch_props_for_game
# ---------------------------------------------------------------------------
async def fetch_props_for_game(
    event_id: str,
    markets: str | None = None,
    bookmakers: str | None = None,
) -> list:
    """Retorna props de jogador para um evento especifico.

    - Verifica quota antes de consumir um request; retorna [] se esgotada.
    - Agrupa odds de todas as casas por (player_name, market_key, direction, line).
    - Calcula line_movement comparando com a linha de abertura do dia (em memoria).

    Output: lista de dicts com:
        player_name, market, line, direction, odd_decimal,
        bookmaker, all_odds, line_opened, line_movement.

    Replica a logica de get_props_for_game() do legado odds.py.
    """
    cfg = get_settings()
    if not cfg.odds_api_key:
        log.error("fetch_props_for_game: ODDS_API_KEY nao configurada")
        return []

    remaining = _quota_state["remaining"]
    if remaining is not None and remaining < 1:
        log.warning(
            "fetch_props_for_game: quota esgotada (%s restantes), requisicao ignorada",
            remaining,
        )
        return []

    url = f"{cfg.odds_api_base}/sports/{cfg.sport}/events/{event_id}/odds"
    params: dict = {
        "apiKey": cfg.odds_api_key,
        "regions": cfg.regions,
        "markets": markets or cfg.markets,
        "oddsFormat": "decimal",
    }
    if bookmakers:
        params["bookmakers"] = bookmakers

    data = await request_json(
        url,
        params=params,
        on_response=_on_response,
        no_retry_statuses=(401, 422),
    )
    if not data:
        return []

    bookmakers_list = data.get("bookmakers", [])
    if not bookmakers_list:
        return []

    # --- Agrupamento por (player, market, direction, line) ---
    # Mesmo algoritmo do legado odds.py.
    all_data: dict = {}
    for bm in bookmakers_list:
        bm_key = normalize_bookmaker_name(bm.get("key", ""))
        for market in bm.get("markets", []):
            market_key = market.get("key")
            for oc in market.get("outcomes", []):
                name = oc.get("name", "")
                description = oc.get("description") or oc.get("participant") or ""
                point = oc.get("point")
                price = oc.get("price")
                player_name = description if description else name

                direction: str | None = None
                if name.lower() == "over":
                    direction = "over"
                elif name.lower() == "under":
                    direction = "under"
                else:
                    continue

                if point is None or price is None:
                    continue

                k = (player_name, market_key, direction, float(point))
                all_data.setdefault(k, {})[bm_key] = float(price)

    # --- Rastreamento de linha de abertura (em memoria, por dia) ---
    today = datetime.now(UTC).strftime("%Y-%m-%d")

    out: list = []
    for (player_name, market_key, direction, line), bm_odds in all_data.items():
        best_bm = max(bm_odds, key=lambda b: bm_odds[b])
        best_odd = bm_odds[best_bm]
        all_odds_list = sorted(
            [{"bookmaker": b, "odd": o} for b, o in bm_odds.items()],
            key=lambda x: x["odd"],
            reverse=True,
        )

        hist_key = f"{event_id}|{player_name}|{market_key}|{direction}|{today}"
        opening_line = _line_history_get_or_set(hist_key, line)
        line_movement = round(line - opening_line, 1)

        out.append(
            {
                "player_name": player_name,
                "market": market_key,
                "line": line,
                "direction": direction,
                "odd_decimal": best_odd,
                "bookmaker": best_bm,
                "all_odds": all_odds_list,
                "line_opened": opening_line,
                "line_movement": line_movement,
            }
        )

    return out


# ---------------------------------------------------------------------------
# Rastreamento de linha de abertura (em memoria — sem I/O de arquivo)
# ---------------------------------------------------------------------------
# Substituicao da abordagem de arquivo JSON do legado.
# Mantido em memoria por ser um processo de vida curta (workers ARQ/FastAPI).
# Chaves antigas sao purgadas automaticamente quando o dia muda.

_line_history: dict[str, float] = {}
_line_history_day: str = ""


def _line_history_get_or_set(key: str, current_line: float) -> float:
    """Retorna a linha de abertura registrada para a chave, ou registra current_line como abertura."""
    global _line_history, _line_history_day

    today = datetime.now(UTC).strftime("%Y-%m-%d")
    if _line_history_day != today:
        # Novo dia: purga historico antigo
        _line_history = {}
        _line_history_day = today

    if key not in _line_history:
        _line_history[key] = current_line

    return _line_history[key]
