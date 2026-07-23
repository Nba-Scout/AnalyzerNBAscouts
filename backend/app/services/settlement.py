"""Liquidação de props e apostas contra o resultado real (data warehouse).

Depois que os jogos terminam, o sync do DW ingere os game logs; este serviço
cruza cada prop analisada (e cada aposta pendente da carteira) com o stat real
do jogador naquele jogo e grava o resultado:

- props (analyzed_props): result = win/loss/push/void + actual_value → alimenta
  o Backtesting Panel (/api/backtest).
- apostas (bets): auto-liquidação — win/loss/push + profit_loss, como o PATCH
  manual de /api/bets faria.

Puro Postgres (sem chamadas externas); idempotente — só varre result IS NULL.
"""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.stats_parsing import _normalize_name
from app.core.constants import MARKET_TO_STAT
from app.db.models.analysis import AnalysisSnapshot
from app.db.models.bet import Bet
from app.db.models.player import Player
from app.db.models.player_game_log import PlayerGameLog
from app.db.models.prop import AnalyzedProp

log = logging.getLogger(__name__)

# Depois de N dias sem game log, assume que o jogador não jogou → void.
VOID_AFTER_DAYS = 3

# Códigos de stat aceitos diretamente (a carteira grava "PTS"-style; as props
# gravam market_key da Odds API). Ambos resolvem para a coluna do DW.
_STAT_CODES = {"PTS", "REB", "AST", "FG3M", "BLK", "STL", "PRA", "PR", "PA", "RA", "STOCKS"}
# Aliases de UI (lib/teams.ts usa 3PM no label; o form da carteira usa FG3M).
_ALIASES = {"3PM": "FG3M"}


def stat_column(market: str) -> str | None:
    """Resolve um mercado (odds-api key OU código de stat) para a coluna do DW."""
    code = MARKET_TO_STAT.get(market)
    if code is None:
        up = (market or "").upper()
        code = _ALIASES.get(up, up if up in _STAT_CODES else None)
    return code.lower() if code else None


def stat_from_log(game_log: PlayerGameLog, market: str) -> float | None:
    """Valor real do stat do mercado no game log (None se mercado desconhecido)."""
    col = stat_column(market)
    if col is None:
        return None
    value = getattr(game_log, col, None)
    return float(value) if value is not None else None


def decide(actual: float, line: float, direction: str) -> str:
    """win/loss/push de uma prop dado o valor real."""
    if actual == line:
        return "push"
    over = actual > line
    return "win" if over == (direction.lower() == "over") else "loss"


async def _find_log(session: AsyncSession, player_id: int, game_date: date) -> PlayerGameLog | None:
    """Game log na data da análise (ou véspera — análise pós-meia-noite UTC)."""
    result = await session.execute(
        select(PlayerGameLog)
        .where(
            PlayerGameLog.player_id == player_id,
            PlayerGameLog.game_date.in_([game_date, game_date - timedelta(days=1)]),
        )
        .order_by(PlayerGameLog.game_date.desc())
        .limit(1)
    )
    return result.scalars().first()


async def _resolve_player_ids(session: AsyncSession, names: set[str]) -> dict[str, int]:
    """normalized_name → Player.id para o lote (1 query)."""
    norms = {_normalize_name(n): n for n in names}
    if not norms:
        return {}
    result = await session.execute(
        select(Player.normalized_name, Player.id).where(Player.normalized_name.in_(norms.keys()))
    )
    by_norm: dict[str, int] = {norm: pid for norm, pid in result.all()}
    return {orig: by_norm[norm] for norm, orig in norms.items() if norm in by_norm}


async def settle_analyzed_props(session: AsyncSession, today: date | None = None) -> dict:
    """Liquida props de snapshots de dias anteriores contra o DW."""
    today = today or datetime.now(UTC).date()
    now = datetime.now(UTC)

    rows = (
        await session.execute(
            select(AnalyzedProp, AnalysisSnapshot.generated_at)
            .join(AnalysisSnapshot, AnalyzedProp.snapshot_id == AnalysisSnapshot.id)
            .where(AnalyzedProp.result.is_(None))
        )
    ).all()
    # Só jogos já encerrados (snapshot de dia anterior).
    pending = [(p, gen.date()) for p, gen in rows if gen.date() < today]
    if not pending:
        return {"settled": 0, "void": 0, "waiting": 0}

    player_ids = await _resolve_player_ids(session, {p.player_name for p, _ in pending})

    settled = void = waiting = 0
    for prop, snap_date in pending:
        pid = player_ids.get(prop.player_name)
        game_log = await _find_log(session, pid, snap_date) if pid is not None else None
        actual = stat_from_log(game_log, prop.market_key) if game_log is not None else None

        if actual is None:
            # Sem log: espera o sync do DW; após a carência, marca void.
            if (today - snap_date).days >= VOID_AFTER_DAYS:
                prop.result = "void"
                prop.settled_at = now
                void += 1
            else:
                waiting += 1
            continue

        prop.actual_value = actual
        prop.result = decide(actual, prop.line, prop.direction)
        prop.settled_at = now
        settled += 1

    await session.commit()
    log.info("settle_analyzed_props: %d liquidadas, %d void, %d aguardando", settled, void, waiting)
    return {"settled": settled, "void": void, "waiting": waiting}


async def settle_pending_bets(session: AsyncSession, today: date | None = None) -> dict:
    """Auto-liquida apostas pendentes da carteira contra o DW.

    Mesma matemática do PATCH manual de /api/bets: win → stake*(odd-1);
    loss → -stake; push → 0. Jogador sem jogo após a carência → push (anulada).
    """
    today = today or datetime.now(UTC).date()
    now = datetime.now(UTC)

    bets = (await session.execute(select(Bet).where(Bet.result.is_(None)))).scalars().all()
    pending = [b for b in bets if b.added_at is not None and b.added_at.date() < today]
    if not pending:
        return {"settled": 0, "waiting": 0}

    player_ids = await _resolve_player_ids(session, {b.player_name for b in pending})

    settled = waiting = 0
    for bet in pending:
        bet_date = bet.added_at.date()
        pid = player_ids.get(bet.player_name)
        game_log = await _find_log(session, pid, bet_date) if pid is not None else None
        actual = stat_from_log(game_log, bet.market_key) if game_log is not None else None

        if actual is None:
            if (today - bet_date).days >= VOID_AFTER_DAYS:
                result = "push"  # anulada: jogador não jogou
            else:
                waiting += 1
                continue
        else:
            result = decide(actual, bet.line, bet.direction)

        bet.result = result
        bet.status = result
        bet.settled_at = now
        if result == "win":
            bet.profit_loss = round(bet.stake * (bet.odd_decimal - 1), 2)
        elif result == "loss":
            bet.profit_loss = -bet.stake
        else:
            bet.profit_loss = 0.0
        settled += 1

    await session.commit()
    log.info("settle_pending_bets: %d liquidadas, %d aguardando", settled, waiting)
    return {"settled": settled, "waiting": waiting}
