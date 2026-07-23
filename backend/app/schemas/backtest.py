"""Schemas do Backtesting Panel — ROI histórico das props liquidadas."""

from __future__ import annotations

from pydantic import BaseModel


class BacktestDay(BaseModel):
    date: str  # YYYY-MM-DD (data do snapshot/jogos)
    props: int  # liquidadas no dia (win+loss+push)
    wins: int
    losses: int
    pushes: int
    pnl_units: float  # P&L do dia com stake flat de 1u por prop
    cum_units: float  # curva acumulada


class BacktestSummary(BaseModel):
    rating: str  # filtro aplicado (strong/value/all)
    days: int  # janela consultada
    props: int  # total liquidado (win+loss+push)
    wins: int
    losses: int
    pushes: int
    voids: int
    pending: int  # ainda não liquidadas na janela
    hit_rate: float  # % wins/(wins+losses); 0 se nada decidido
    pnl_units: float  # P&L total (stake flat 1u)
    roi_pct: float  # pnl / props apostadas × 100
    avg_odd: float


class BacktestResponse(BaseModel):
    summary: BacktestSummary
    series: list[BacktestDay]
