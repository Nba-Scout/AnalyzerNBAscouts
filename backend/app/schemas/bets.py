from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class BetCreate(BaseModel):
    player_name: str
    market_key: str
    line: float
    direction: str
    odd_decimal: float
    ev_pct: float = 0.0
    kelly_pct: float = 0.0
    stake: float = 0.0


class BetSettle(BaseModel):
    result: str  # "win" | "loss" | "push"


class BetOut(BaseModel):
    id: int
    player_name: str
    market_key: str
    line: float
    direction: str
    odd_decimal: float
    ev_pct: float
    kelly_pct: float
    stake: float
    status: str
    result: str | None
    profit_loss: float | None
    added_at: datetime
    settled_at: datetime | None

    model_config = {"from_attributes": True}
