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
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    from app.cache import keys, repository
    from app.clients.odds import get_quota_remaining
    from app.core.constants import MARKET_LABELS
    from app.core.redis import get_redis
    from app.db.models.analysis import AnalysisSnapshot
    from app.db.models.line import LineSnapshot
    from app.db.models.prop import AnalyzedProp
    from app.db.session import get_session_factory
    from app.services import analysis as analysis_svc

    log.info("run_daily_analysis: iniciando")
    started = datetime.now(UTC)
    today = started.date()

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
            # Reporta ao Sentry explicitamente: a exceção é tratada/engolida aqui
            # (status='error' + return), então NÃO chega à ArqIntegration sozinha.
            # No-op se SENTRY_DSN não estiver configurado.
            import sentry_sdk

            sentry_sdk.capture_exception(exc)
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
            player_name = e.get("player_name") or e.get("player", "")
            market_key = e.get("market_key", "")
            direction = e.get("direction", "over")
            line = float(e.get("line", 0.0))

            # Linha de abertura durável (sobrevive a restart do worker): upsert
            # em line_snapshots; primeira aparição grava abertura = atual, demais
            # só atualizam line_current. line_opened retornado é a autoridade.
            line_opened = await _upsert_line_snapshot(
                session, pg_insert, LineSnapshot, today, player_name, market_key, direction, line
            )

            prop = AnalyzedProp(
                snapshot_id=snapshot_id,
                player_name=player_name,
                team=e.get("team", ""),
                opponent=e.get("opponent", ""),
                market_key=market_key,
                market_label=e.get("market_label") or MARKET_LABELS.get(market_key, ""),
                line=line,
                direction=direction,
                odd_decimal=float(e.get("odd_decimal", 0.0)),
                odd_implied_prob=float(e.get("odd_implied_prob", 0.0)),
                bookmaker=e.get("bookmaker", ""),
                all_odds=e.get("all_odds", []),
                line_opened=line_opened,
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

        # Quota consumida nesta análise (o odds client rastreia em memória no
        # mesmo processo do worker). Em modo demo nenhuma chamada ocorre → 0.
        remaining = get_quota_remaining()
        quota_used = max(0, 500 - int(remaining)) if remaining is not None else 0

        # --- Atualiza snapshot ---
        snapshot.status = "demo" if is_demo else "ok"
        snapshot.props_count = props_count
        snapshot.strong_count = strong_count
        snapshot.games_count = games_count
        snapshot.quota_used = quota_used
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


async def _upsert_line_snapshot(
    session,
    pg_insert,
    LineSnapshot,  # noqa: N803 — modelo passado por injeção para evitar import circular
    game_date,
    player_name: str,
    market_key: str,
    direction: str,
    line: float,
) -> float:
    """Upsert da linha do dia; retorna a linha de abertura (autoridade durável).

    Primeira aparição de (game_date, player, market, direction) grava
    line_opened = line_current = line. Aparições seguintes atualizam apenas
    line_current, preservando line_opened — sobrevive a restart do worker.
    """
    stmt = (
        pg_insert(LineSnapshot)
        .values(
            game_date=game_date,
            player_name=player_name,
            market_key=market_key,
            direction=direction,
            line_opened=line,
            line_current=line,
        )
        .on_conflict_do_update(
            constraint="uq_line_snapshot",
            set_={"line_current": line},
        )
        .returning(LineSnapshot.line_opened)
    )
    result = await session.execute(stmt)
    opened = result.scalar_one_or_none()
    return float(opened) if opened is not None else line


async def backfill_player(ctx: dict, full_name: str, n_seasons: int = 3) -> dict:
    """Backfill do data warehouse para um jogador (via ESPN), por nome.

    Usado tanto pelo lazy-refresh (/api/player com DW vazio) quanto pelo
    backfill eager. Persiste em player_game_logs + atualiza sync_state.
    """
    from app.db.session import get_session_factory
    from app.services import ingest

    log.info("backfill_player: %s (n_seasons=%d)", full_name, n_seasons)
    async with get_session_factory()() as session:
        result = await ingest.backfill_player_espn(session, full_name=full_name, n_seasons=n_seasons)
    log.info("backfill_player: %s — %s", full_name, result.get("status"))
    return result


async def backfill_all_active(ctx: dict, n_seasons: int = 3) -> dict:
    """Enfileira backfill ESPN para todos os jogadores ativos (lista nba_api static).

    A lista de ativos vem de nba_api.stats.static (dados embutidos, sem geoblock).
    Cada jogador vira um job backfill_player independente (throttle natural pela
    fila ARQ). Retorna quantos foram enfileirados.
    """
    from app.clients.nba_live import get_active_player_names
    from app.core.arq import get_arq_pool

    names = await get_active_player_names()
    pool = get_arq_pool()
    if pool is None:
        log.warning("backfill_all_active: pool ARQ indisponivel")
        return {"status": "error", "error": "no_arq_pool", "active": len(names)}

    enqueued = 0
    for name in names:
        try:
            await pool.enqueue_job("backfill_player", name, n_seasons)
            enqueued += 1
        except Exception as exc:  # noqa: BLE001
            log.warning("backfill_all_active: falha ao enfileirar %s: %s", name, exc)

    log.info("backfill_all_active: %d/%d jogadores enfileirados", enqueued, len(names))
    return {"status": "ok", "active": len(names), "enqueued": enqueued}
