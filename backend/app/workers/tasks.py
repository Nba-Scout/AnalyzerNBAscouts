"""Tasks ARQ — analise diaria e sincronizacao de gamelogs em background."""

from __future__ import annotations

import logging
from datetime import UTC, datetime

log = logging.getLogger(__name__)


async def run_daily_analysis(ctx: dict) -> dict:
    """Task principal: executa analyze_day() e persiste snapshot no Postgres.

    Fluxo:
      1. Cria AnalysisSnapshot com status='running'
      2. Chama services.analysis.analyze_day()
      3. Persiste cada entry como AnalyzedProp vinculado ao snapshot
      4. Atualiza snapshot com status='ok' (ou 'demo' / 'error')
      5. Retorna sumario com props_count, strong_count, games_count, duration_s
    """
    from app.cache import keys, repository
    from app.core.constants import MARKET_LABELS
    from app.core.redis import get_redis
    from app.db.models.analysis import AnalysisSnapshot
    from app.db.models.prop import AnalyzedProp
    from app.db.session import get_session_factory
    from app.services import analysis as analysis_svc

    log.info("run_daily_analysis: iniciando")
    started = datetime.now(UTC)

    async with get_session_factory()() as session:
        # --- Cria snapshot inicial ---
        snapshot = AnalysisSnapshot(status="running")
        session.add(snapshot)
        await session.flush()  # obtem snapshot.id sem commit
        snapshot_id = snapshot.id

        try:
            entries = await analysis_svc.analyze_day()
        except Exception as exc:
            log.exception("analyze_day() falhou: %s", exc)
            elapsed = (datetime.now(UTC) - started).total_seconds()
            snapshot.status = "error"
            snapshot.error_message = str(exc)[:500]
            snapshot.duration_seconds = elapsed
            await session.commit()
            return {"props_count": 0, "status": "error", "error": str(exc)}

        is_demo = any(e.get("_demo") for e in entries)
        props_count = len(entries)
        strong_count = sum(1 for e in entries if e.get("classification") == "strong")
        # Conta jogos unicos inferidos por (team, opponent)
        games_seen: set[frozenset] = set()
        for e in entries:
            games_seen.add(frozenset([e.get("team", ""), e.get("opponent", "")]))
        games_count = len(games_seen)

        # --- Persiste props ---
        for e in entries:
            prop = AnalyzedProp(
                snapshot_id=snapshot_id,
                player_name=e.get("player_name") or e.get("player", ""),
                team=e.get("team", ""),
                opponent=e.get("opponent", ""),
                market_key=e.get("market_key", ""),
                market_label=e.get("market_label") or MARKET_LABELS.get(e.get("market_key", ""), ""),
                line=float(e.get("line", 0.0)),
                direction=e.get("direction", "over"),
                odd_decimal=float(e.get("odd_decimal", 0.0)),
                odd_implied_prob=float(e.get("odd_implied_prob", 0.0)),
                bookmaker=e.get("bookmaker", ""),
                all_odds=e.get("all_odds", []),
                true_probability=float(e.get("true_probability", 0.0)),
                ev_percent=float(e.get("ev_percent", 0.0)),
                kelly_fraction=float(e.get("kelly_fraction", 0.0)),
                classification=e.get("classification", "neutral"),
                avg_stat_last10=float(e.get("avg_stat_last10", 0.0)),
                games_over_line_pct=float(e.get("games_over_line_pct", 0.0)),
                last5_values=e.get("last5_values", []),
                def_rating_opponent=float(e.get("def_rating_opponent", 0.0)),
                pace=float(e.get("pace", 0.0)),
                minutes_avg=float(e.get("minutes_avg", 0.0)),
                projected_min=float(e["projected_min"]) if e.get("projected_min") is not None else None,
                min_boost_pct=float(e.get("min_boost_pct", 0.0)),
                dvp_rank=int(e.get("dvp_rank", 0)),
                dvp_total=int(e.get("dvp_total", 0)),
                team_injuries=e.get("team_injuries", []),
            )
            session.add(prop)

        elapsed = (datetime.now(UTC) - started).total_seconds()

        # --- Atualiza snapshot ---
        snapshot.status = "demo" if is_demo else "ok"
        snapshot.props_count = props_count
        snapshot.strong_count = strong_count
        snapshot.games_count = games_count
        snapshot.duration_seconds = elapsed
        snapshot.is_demo = is_demo

        await session.commit()

    # Invalida o cache de /api/props e grava status para /api/status
    redis = get_redis()
    if redis is not None:
        try:
            await repository.delete(redis, keys.latest_snapshot())
            await repository.set_json(
                redis,
                keys.analysis_status(),
                {
                    "status": "demo" if is_demo else "ok",
                    "props_count": props_count,
                    "strong_count": strong_count,
                    "games_count": games_count,
                    "is_demo": is_demo,
                    "duration_s": round(elapsed, 2),
                },
                24 * 60 * 60,
            )
        except Exception as exc:  # noqa: BLE001 — cache nao pode derrubar a task
            log.warning("Falha ao atualizar cache pos-analise: %s", exc)

    log.info(
        "run_daily_analysis: %d props (%d strong) em %.1fs — %s",
        props_count,
        strong_count,
        elapsed,
        "DEMO" if is_demo else "live",
    )
    return {
        "props_count": props_count,
        "strong_count": strong_count,
        "games_count": games_count,
        "duration_s": round(elapsed, 2),
        "is_demo": is_demo,
        "status": "demo" if is_demo else "ok",
    }


async def sync_player_logs(ctx: dict, player_id: int) -> dict:
    """Lazy-refresh: sincroniza gamelogs de um jogador especifico no Redis.

    Fluxo:
      1. Busca gamelog raw da ESPN via fetch_player_gamelog
      2. Constroi stats via build_player_stats
      3. Atualiza cache Redis (TTL 6h) via services.players (set_json)
      4. Retorna sumario com games_played e status
    """
    from app.analytics.stats_parsing import build_player_stats
    from app.cache import keys as cache_keys
    from app.cache.repository import set_json
    from app.clients.espn import fetch_player_gamelog
    from app.core.config import get_settings
    from app.core.redis import get_redis

    cfg = get_settings()
    n_games = cfg.lookback_games

    log.info("sync_player_logs: player_id=%s", player_id)

    try:
        raw = await fetch_player_gamelog(str(player_id), n_games=n_games)
    except Exception as exc:
        log.warning("fetch_player_gamelog falhou para player_id=%s: %s", player_id, exc)
        return {"player_id": player_id, "status": "error", "error": str(exc)}

    if not raw:
        log.info("sync_player_logs: sem dados ESPN para player_id=%s", player_id)
        return {"player_id": player_id, "status": "not_found"}

    try:
        stats = build_player_stats(raw, n_games)
    except Exception as exc:
        log.warning("build_player_stats falhou para player_id=%s: %s", player_id, exc)
        return {"player_id": player_id, "status": "error", "error": str(exc)}

    redis = get_redis()
    if redis is not None:
        key = cache_keys.player_stats(player_id)
        cacheable = {k: v for k, v in stats.items() if k != "df"}
        try:
            await set_json(redis, key, cacheable, 6 * 60 * 60)
            log.info("sync_player_logs: cache atualizado para player_id=%s", player_id)
        except Exception as exc:
            log.warning("Redis set_json falhou para player_id=%s: %s", player_id, exc)

    games_played = stats.get("games_played", 0)
    log.info("sync_player_logs: player_id=%s — %d jogos sincronizados", player_id, games_played)
    return {
        "player_id": player_id,
        "games_played": games_played,
        "status": "ok",
    }
