"""Retenção da série temporal de linhas (line_history).

`line_history` é APPEND-ONLY: cada rodada de análise acrescenta um ponto por prop
(~100–300 props/dia × N rodadas). Sem poda ela cresce para sempre, e o que dá
valor ao Line Movement Graph é o intraday recente — não o de meses atrás.

Por que podar é seguro: a odd e a linha do momento da análise ficam gravadas em
definitivo em `analyzed_props` (livro-caixa append-only, nunca podado), e a linha
de abertura do dia em `line_snapshots`. O que se perde aqui é apenas a resolução
intraday de jogos antigos — nada que alimente backtest ou treino.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.line import LineHistory

log = logging.getLogger(__name__)


async def prune_line_history(session: AsyncSession, retention_days: int, *, today: date | None = None) -> int:
    """Apaga pontos de jogos anteriores à janela de retenção. Devolve nº de linhas.

    O corte é por `game_date`, não por `captured_at`, por dois motivos: o worker
    grava `game_date=today` no mesmo instante da captura (workers/tasks.py), então
    as duas colunas datam a linha igualmente; e `game_date` é a PRIMEIRA coluna do
    índice `ix_line_hist_lookup`, então o DELETE usa o índice em vez de varrer a
    tabela (`captured_at` é a 5ª — inútil como prefixo).

    `retention_days <= 0` desliga a poda (no-op), para permitir manter tudo sem
    precisar remover a chamada.
    """
    if retention_days <= 0:
        return 0
    cutoff = (today or date.today()) - timedelta(days=retention_days)
    result = await session.execute(delete(LineHistory).where(LineHistory.game_date < cutoff))
    # rowcount é tipado em CursorResult, não no Result genérico que execute() declara.
    deleted: int = result.rowcount or 0  # type: ignore[attr-defined]
    if deleted:
        log.info("prune_line_history: %d pontos apagados (game_date < %s)", deleted, cutoff)
    return deleted
