from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Bet(Base):
    """Bet tracker server-side — feature nova, substitui localStorage."""

    __tablename__ = "bets"
    __table_args__ = (Index("ix_bets_status", "status"),)

    id: Mapped[int] = mapped_column(primary_key=True)

    # Prop apostada
    player_name: Mapped[str] = mapped_column(String(120), nullable=False)
    market_key: Mapped[str] = mapped_column(String(60), nullable=False)
    line: Mapped[float] = mapped_column(Float, nullable=False)
    direction: Mapped[str] = mapped_column(String(10), nullable=False)
    odd_decimal: Mapped[float] = mapped_column(Float, nullable=False)

    # Análise no momento da aposta
    ev_pct: Mapped[float] = mapped_column(Float, default=0.0)
    kelly_pct: Mapped[float] = mapped_column(Float, default=0.0)

    # Gestão de bankroll
    stake: Mapped[float] = mapped_column(Float, default=0.0)

    # Resultado
    status: Mapped[str] = mapped_column(String(10), default="open")
    # "open" | "win" | "loss" | "push"
    result: Mapped[str | None] = mapped_column(String(10), nullable=True)
    profit_loss: Mapped[float | None] = mapped_column(Float, nullable=True)

    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
