"""Tasks ARQ — análise diária em background."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

log = logging.getLogger(__name__)


async def run_daily_analysis(ctx: dict) -> dict:
    """Task principal: chama analyze_day() e grava snapshot no Postgres.

    TODO (A2/A4): importar services.analysis.analyze_day (async) e
    persistir o resultado em AnalysisSnapshot + AnalyzedProp.
    """
    log.info("run_daily_analysis: iniciando")
    started = datetime.now(timezone.utc)

    # stub
    result = {"props_count": 0, "status": "stub"}

    elapsed = (datetime.now(timezone.utc) - started).total_seconds()
    log.info(f"run_daily_analysis: concluído em {elapsed:.1f}s")
    return result


async def sync_player_logs(ctx: dict, player_id: int) -> dict:
    """Lazy-refresh: sincroniza os gamelogs de um jogador específico.

    Chamado quando o endpoint de player detecta dados 'velhos'.
    TODO (A3): implementar usando clients/espn.py async + player_game_logs.
    """
    log.info(f"sync_player_logs: player_id={player_id}")
    return {"player_id": player_id, "status": "stub"}
