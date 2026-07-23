"""Router de props — lê do banco/Redis, nunca dispara análise inline."""

from __future__ import annotations

import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache import keys, repository
from app.core.arq import get_arq_pool
from app.core.redis import get_redis
from app.db.models.analysis import AnalysisSnapshot
from app.db.models.line import LineHistory
from app.db.models.prop import AnalyzedProp
from app.db.session import get_db
from app.schemas.props import LineHistoryPoint, LineHistoryResponse, PropsResponse
from app.schemas.status import RefreshOut, StatusOut

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["props"])

# TTL do cache-aside de /api/props (segundos). Invalidado pelo worker ao
# gravar um novo snapshot; o TTL e apenas uma rede de seguranca.
_PROPS_CACHE_TTL = 120
# Janela minima entre dois /api/refresh (segundos).
_REFRESH_THROTTLE = 60


@router.get("/props", response_model=PropsResponse)
async def get_props(db: AsyncSession = Depends(get_db)) -> PropsResponse:
    """Retorna o último snapshot de props — resposta < 50ms (cache-aside Redis)."""
    redis = get_redis()

    # 1) Tenta o cache (preenchido on-demand abaixo, invalidado pelo worker)
    if redis is not None:
        try:
            cached = await repository.get_json(redis, keys.latest_snapshot())
            if cached is not None:
                return PropsResponse(**cached)
        except Exception as exc:  # noqa: BLE001 — cache nunca derruba a request
            log.warning("Falha ao ler cache de props: %s", exc)

    # 2) Miss → lê do banco
    snap = await db.scalar(
        select(AnalysisSnapshot)
        .where(AnalysisSnapshot.status.in_(["ok", "demo"]))
        .order_by(AnalysisSnapshot.generated_at.desc())
        .limit(1)
    )
    if snap is None:
        return PropsResponse(
            props=[],
            generated_at="",
            from_cache=False,
            demo_mode=False,
            quota_remaining=0,
            quota_limit=500,
        )

    result = await db.execute(
        select(AnalyzedProp).where(AnalyzedProp.snapshot_id == snap.id).order_by(AnalyzedProp.ev_percent.desc())
    )
    rows = result.scalars().all()

    response = PropsResponse(
        props=[_row_to_out(r) for r in rows],
        generated_at=snap.generated_at.isoformat(),
        from_cache=False,
        demo_mode=snap.is_demo,
        quota_remaining=max(0, 500 - snap.quota_used),
        quota_limit=500,
    )

    # 3) Aquece o cache para as próximas chamadas
    if redis is not None:
        try:
            await repository.set_json(redis, keys.latest_snapshot(), response.model_dump(), _PROPS_CACHE_TTL)
        except Exception as exc:  # noqa: BLE001
            log.warning("Falha ao gravar cache de props: %s", exc)

    return response


@router.get("/line-history", response_model=LineHistoryResponse)
async def get_line_history(
    player: str,
    market: str,
    direction: str = "over",
    on_date: str | None = Query(default=None, alias="date"),
    db: AsyncSession = Depends(get_db),
) -> LineHistoryResponse:
    """Série temporal da linha de uma prop (movimento intraday).

    `player`, `market` (market_key) e `direction` identificam a prop.
    Se `date` (YYYY-MM-DD) for omitido, usa o dia mais recente disponível.
    """
    base = LineHistory.__table__.c
    filt = [base.player_name == player, base.market_key == market, base.direction == direction]

    target_date: date | str | None
    if on_date is None:
        target_date = await db.scalar(
            select(LineHistory.game_date).where(*filt).order_by(LineHistory.game_date.desc()).limit(1)
        )
    else:
        target_date = on_date  # comparação direta com a coluna Date (asyncpg aceita ISO str)

    points: list[LineHistoryPoint] = []
    if target_date is not None:
        result = await db.execute(
            select(LineHistory)
            .where(*filt, LineHistory.game_date == target_date)
            .order_by(LineHistory.captured_at.asc())
        )
        points = [
            LineHistoryPoint(captured_at=r.captured_at.isoformat(), line=r.line, odd=r.odd_decimal)
            for r in result.scalars().all()
        ]

    return LineHistoryResponse(player_name=player, market=market, direction=direction, points=points)


@router.get("/status", response_model=StatusOut)
async def get_status(db: AsyncSession = Depends(get_db)) -> StatusOut:
    snap = await db.scalar(select(AnalysisSnapshot).order_by(AnalysisSnapshot.generated_at.desc()).limit(1))

    # is_refreshing reflete o snapshot ativo no banco (o worker grava
    # status="running" ao iniciar e "ok"/"demo"/"error" ao concluir).
    # O refresh_lock no Redis serve apenas de throttle para /api/refresh.
    is_refreshing = snap.status == "running" if snap else False

    return StatusOut(
        is_refreshing=is_refreshing,
        cached_at=snap.generated_at.isoformat() if snap else None,
        next_refresh_in=None,
        quota_remaining=max(0, 500 - snap.quota_used) if snap else 500,
        warehouse_last_sync=None,
    )


@router.post("/refresh", response_model=RefreshOut)
async def trigger_refresh() -> RefreshOut:
    """Enfileira uma análise imediata via ARQ (throttled por lock no Redis)."""
    pool = get_arq_pool()
    if pool is None:
        raise HTTPException(status_code=503, detail="Fila indisponível no momento.")

    # Throttle: SET NX EX — se o lock já existe, não re-enfileira
    redis = get_redis()
    if redis is not None:
        try:
            acquired = await redis.set(keys.refresh_lock(), "1", nx=True, ex=_REFRESH_THROTTLE)
            if not acquired:
                return RefreshOut(
                    queued=False,
                    message="Análise recente já em andamento — aguarde alguns instantes.",
                )
        except Exception as exc:  # noqa: BLE001 — sem Redis, segue sem throttle
            log.warning("Throttle de refresh indisponível: %s", exc)

    try:
        await pool.enqueue_job("run_daily_analysis")
    except Exception as exc:  # noqa: BLE001
        log.exception("Falha ao enfileirar análise: %s", exc)
        raise HTTPException(status_code=503, detail="Não foi possível enfileirar a análise.") from exc

    return RefreshOut(queued=True, message="Análise enfileirada.")


def _row_to_out(r: AnalyzedProp) -> dict:
    return {
        "player_name": r.player_name,
        "team": r.team,
        "game": f"vs {r.opponent}",
        "market": r.market_label or r.market_key,
        "market_key": r.market_key,
        "line": r.line,
        "direction": r.direction.upper(),
        "odd": r.odd_decimal,
        "prob_real": r.true_probability,
        "ev_pct": round(r.ev_percent, 2),
        "kelly_pct": round(r.kelly_fraction * 100, 2),
        "kelly_full_pct": round(r.kelly_fraction * 100 * 4, 2),
        "rating": r.classification.upper(),
        "bookmaker": r.bookmaker,
        "games_over_line_pct": r.games_over_line_pct,
        "all_odds": r.all_odds or [],
        "team_injuries": r.team_injuries or [],
        "dvp_rank": r.dvp_rank,
        "dvp_total": r.dvp_total,
        "line_movement": round(r.line - (r.line_opened if r.line_opened is not None else r.line), 1),
        "line_opened": r.line_opened if r.line_opened is not None else r.line,
        "projected_min": r.projected_min,
        "min_boost_pct": r.min_boost_pct,
        "last5_values": r.last5_values or [],
        "avg_stat_last10": round(r.avg_stat_last10, 2),
        "def_rating_opponent": round(r.def_rating_opponent, 2),
        "pace": round(r.pace, 2),
        "implied_prob": round(r.odd_implied_prob, 4),
        "minutes_avg": round(r.minutes_avg, 1),
    }
