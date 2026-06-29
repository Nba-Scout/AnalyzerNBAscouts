"""Detalhe de jogador para /api/player — híbrido data warehouse → fallback ESPN.

Estratégia:
  1. Resolve o jogador no Postgres (Player.normalized_name).
  2. Se houver gamelogs no data warehouse (player_game_logs) → monta tudo via SQL.
     (Wired mas no-op até o Passo 5 popular o DW; cai no fallback enquanto vazio.)
  3. Senão → ESPN: resolve espn_id (Player.espn_id ou fetch_player_index),
     busca gamelog (n_seasons=3 p/ playoffs anteriores), monta via build_player_stats.

O payload é serializável (sem DataFrame) e cacheado no Redis (TTL 6h).
A resposta espelha campo-a-campo o contrato do legado api.py::get_player.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.stats_parsing import _normalize_name, build_player_stats, extract_playoff_history
from app.cache import keys as cache_keys
from app.cache.repository import get_json, set_json
from app.core.config import get_settings
from app.core.redis import get_redis
from app.db.models.player import Player
from app.db.models.player_game_log import PlayerGameLog
from app.db.models.sync_state import SyncState

log = logging.getLogger(__name__)

_TTL_6H = 6 * 60 * 60


async def get_player_detail(name: str, session: AsyncSession) -> dict | None:
    """Retorna o dict de detalhe do jogador, ou None se não encontrado.

    Cache-aside Redis por nome normalizado.
    """
    norm = _normalize_name(name)
    if not norm:
        return None

    redis = get_redis()
    ckey = cache_keys.player_detail(norm)
    if redis is not None:
        try:
            cached = await get_json(redis, ckey)
            if cached is not None:
                return cached
        except Exception as exc:  # noqa: BLE001 — cache nunca derruba a request
            log.warning("player_detail cache get falhou (%s): %s", ckey, exc)

    # Resolve jogador no Postgres (pode não existir até o Passo 5)
    player = await session.scalar(select(Player).where(Player.normalized_name == norm).limit(1))

    detail: dict | None = None
    from_warehouse = False
    if player is not None:
        detail = await _build_from_warehouse(player, name, session)
        from_warehouse = detail is not None

    if detail is None:
        espn_id = player.espn_id if player is not None else None
        detail = await _build_from_espn(name, espn_id)

    if detail is None:
        return None

    # Lazy-refresh (best-effort, nunca derruba a request):
    #  - DW vazio → servimos via ESPN agora e enfileiramos backfill para popular;
    #  - DW servido mas velho (> lazy_refresh_stale_hours) → enfileira refresh.
    if not from_warehouse or player is not None and await _is_warehouse_stale(session, player.id):
        await _enqueue_backfill(name)

    if redis is not None:
        try:
            await set_json(redis, ckey, detail, _TTL_6H)
        except Exception as exc:  # noqa: BLE001
            log.warning("player_detail cache set falhou (%s): %s", ckey, exc)

    return detail


# ---------------------------------------------------------------------------
# Data warehouse (Passo 5) — wired, no-op enquanto player_game_logs vazio
# ---------------------------------------------------------------------------
async def _build_from_warehouse(player: Player, name: str, session: AsyncSession) -> dict | None:
    cfg = get_settings()
    logs = (
        (
            await session.execute(
                select(PlayerGameLog)
                .where(PlayerGameLog.player_id == player.id)
                .order_by(PlayerGameLog.game_date.desc())
                .limit(cfg.lookback_games)
            )
        )
        .scalars()
        .all()
    )

    if not logs:
        return None  # DW vazio → fallback ESPN

    # logs vêm newest-first (igual ao contrato do frontend)
    recent_games = [
        {
            "date": g.game_date.isoformat() if g.game_date else "",
            "opp": g.opponent_abbr or "—",
            "home_away": g.home_away or "",
            "min": int(g.min_played or 0),
            "pts": int(g.pts or 0),
            "reb": int(g.reb or 0),
            "ast": int(g.ast or 0),
            "fg3m": int(g.fg3m or 0),
            "blk": int(g.blk or 0),
            "stl": int(g.stl or 0),
            "is_playoff": bool(g.is_playoff),
            "margin": int(g.margin or 0),
            "team_score": int(g.team_score or 0),
            "opp_score": int(g.opp_score or 0),
        }
        for g in logs
    ]

    def _avg(attr: str) -> float:
        vals = [getattr(g, attr) for g in logs if getattr(g, attr) is not None]
        return round(sum(vals) / len(vals), 1) if vals else 0.0

    home = [g for g in logs if g.home_away == "home"]
    away = [g for g in logs if g.home_away == "away"]

    def _split_avg(rows: list, attr: str) -> float:
        vals = [getattr(g, attr) for g in rows if getattr(g, attr) is not None]
        return round(sum(vals) / len(vals), 1) if vals else 0.0

    # Playoff history a partir do DW
    po_logs = (
        (
            await session.execute(
                select(PlayerGameLog).where(PlayerGameLog.player_id == player.id, PlayerGameLog.is_playoff.is_(True))
            )
        )
        .scalars()
        .all()
    )

    def _po_avg(attr: str) -> float:
        vals = [getattr(g, attr) for g in po_logs if getattr(g, attr) is not None]
        return round(sum(vals) / len(vals), 1) if vals else 0.0

    po_seasons = sorted({g.season for g in po_logs if g.season})

    return _assemble(
        player_id=player.nba_api_id or 0,
        name=name,
        # team_abbr via join dedicado fica para o Passo 5 (evita lazy-load async aqui)
        team_abbr="",
        position=player.position or "—",
        averages={
            "PTS": _avg("pts"),
            "REB": _avg("reb"),
            "AST": _avg("ast"),
            "PRA": _avg("pra"),
            "PR": _avg("pr"),
            "PA": _avg("pa"),
            "FG3M": _avg("fg3m"),
            "STOCKS": _avg("stocks"),
        },
        home_away_splits={
            "home_games": len(home),
            "home_avg_pts": _split_avg(home, "pts"),
            "home_avg_reb": _split_avg(home, "reb"),
            "home_avg_ast": _split_avg(home, "ast"),
            "away_games": len(away),
            "away_avg_pts": _split_avg(away, "pts"),
            "away_avg_reb": _split_avg(away, "reb"),
            "away_avg_ast": _split_avg(away, "ast"),
        },
        recent_games=recent_games,
        playoff_history={
            "seasons": po_seasons,
            "games_count": len(po_logs),
            "avg_pts": _po_avg("pts"),
            "avg_reb": _po_avg("reb"),
            "avg_ast": _po_avg("ast"),
        },
    )


# ---------------------------------------------------------------------------
# ESPN (fallback ativo hoje)
# ---------------------------------------------------------------------------
async def _build_from_espn(name: str, espn_id: str | None) -> dict | None:
    from app.clients.espn import fetch_player_gamelog, fetch_player_index

    norm = _normalize_name(name)

    if not espn_id:
        try:
            index = await fetch_player_index()
        except Exception as exc:  # noqa: BLE001
            log.warning("fetch_player_index falhou: %s", exc)
            return None
        espn_id = (index or {}).get(norm)
        if not espn_id:
            return None

    cfg = get_settings()
    # n_seasons=3 captura playoffs de temporadas anteriores (shape multi-season)
    try:
        multi = await fetch_player_gamelog(espn_id, n_seasons=3)
    except Exception as exc:  # noqa: BLE001
        log.warning("fetch_player_gamelog falhou para %s: %s", espn_id, exc)
        return None
    if not multi:
        return None

    # Temporada corrente = seasons[0] (offset 0). build_player_stats espera o
    # shape single (com 'seasonTypes' no topo).
    seasons = multi.get("seasons") if isinstance(multi, dict) else None
    current_raw = seasons[0]["data"] if seasons else multi
    stats = build_player_stats(current_raw, cfg.lookback_games)
    po_hist = extract_playoff_history(multi)

    df = stats.get("df")
    recent_games: list[dict] = []
    if df is not None and not df.empty:
        for _, row in df.iterrows():
            opp = str(row.get("Opp", "") or "")
            ha = str(row.get("HomeAway", "") or "")
            recent_games.append(
                {
                    "date": str(row.get("Date", "") or ""),
                    "opp": "—" if (not opp or opp == "nan") else opp,
                    "home_away": "" if ha == "nan" else ha,
                    "min": int(row.get("MIN", 0) or 0),
                    "pts": int(row.get("PTS", 0) or 0),
                    "reb": int(row.get("REB", 0) or 0),
                    "ast": int(row.get("AST", 0) or 0),
                    "fg3m": int(row.get("FG3M", 0) or 0),
                    "blk": int(row.get("BLK", 0) or 0),
                    "stl": int(row.get("STL", 0) or 0),
                    "is_playoff": False,
                    "margin": 0,
                    "team_score": 0,
                    "opp_score": 0,
                }
            )
    # df é cronológico (mais antigo primeiro) → inverte para newest-first
    recent_games.reverse()

    return _assemble(
        player_id=int(espn_id) if str(espn_id).isdigit() else 0,
        name=name,
        team_abbr=stats.get("team_abbr", "") or "",
        position="—",
        averages={
            "PTS": round(stats.get("avg_pts", 0.0), 1),
            "REB": round(stats.get("avg_reb", 0.0), 1),
            "AST": round(stats.get("avg_ast", 0.0), 1),
            "PRA": round(stats.get("avg_pra", 0.0), 1),
            "PR": round(stats.get("avg_pr", 0.0), 1),
            "PA": round(stats.get("avg_pa", 0.0), 1),
            "FG3M": round(stats.get("avg_3pm", 0.0), 1),
            "STOCKS": round(stats.get("avg_stocks", 0.0), 1),
        },
        home_away_splits={
            "home_games": stats.get("games_home", 0),
            "home_avg_pts": round(stats.get("avg_pts_home", 0.0), 1),
            "home_avg_reb": round(stats.get("avg_reb_home", 0.0), 1),
            "home_avg_ast": round(stats.get("avg_ast_home", 0.0), 1),
            "away_games": stats.get("games_away", 0),
            "away_avg_pts": round(stats.get("avg_pts_away", 0.0), 1),
            "away_avg_reb": round(stats.get("avg_reb_away", 0.0), 1),
            "away_avg_ast": round(stats.get("avg_ast_away", 0.0), 1),
        },
        recent_games=recent_games,
        playoff_history=po_hist,
    )


async def _is_warehouse_stale(session: AsyncSession, player_id: int) -> bool:
    """True se o último sync do jogador for mais velho que lazy_refresh_stale_hours.

    Sem SyncState (ou sem last_synced_at) → considerado velho (dispara refresh).
    """
    cfg = get_settings()
    ss = await session.scalar(select(SyncState).where(SyncState.player_id == player_id))
    if ss is None or ss.last_synced_at is None:
        return True
    last = ss.last_synced_at
    if last.tzinfo is None:
        last = last.replace(tzinfo=UTC)
    return (datetime.now(UTC) - last) > timedelta(hours=cfg.lazy_refresh_stale_hours)


async def _enqueue_backfill(name: str) -> None:
    """Enfileira backfill_player (lazy-refresh do DW). Best-effort, sem exceções."""
    from app.core.arq import get_arq_pool

    pool = get_arq_pool()
    if pool is None:
        return
    try:
        await pool.enqueue_job("backfill_player", name)
    except Exception as exc:  # noqa: BLE001
        # Sanitiza o nome (vem da URL) antes de logar p/ evitar log injection.
        safe_name = name.replace("\n", " ").replace("\r", " ")
        log.warning("Falha ao enfileirar backfill de %s: %s", safe_name, exc)


def _assemble(
    *,
    player_id: int,
    name: str,
    team_abbr: str,
    position: str,
    averages: dict[str, float],
    home_away_splits: dict[str, Any],
    recent_games: list[dict],
    playoff_history: dict[str, Any],
) -> dict:
    """Monta o dict final no contrato exato do frontend (legado api.py::get_player)."""
    return {
        "id": player_id,
        "name": name,
        "team": "",
        "teamAbbr": team_abbr,
        "position": position,
        "height": "—",
        "age": "—",
        "home_away_splits": home_away_splits,
        "averages": averages,
        "spark": [g["pts"] for g in reversed(recent_games)],  # oldest-first p/ sparkline
        "recent_games": recent_games,
        "playoff_history": playoff_history,
    }
