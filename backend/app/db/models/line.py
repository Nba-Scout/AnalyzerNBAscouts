from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, Index, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class LineSnapshot(Base):
    """Linha de abertura de cada prop — substitui line_history.json.

    Upsert via ON CONFLICT para preservar apenas a linha de abertura do dia.
    """

    __tablename__ = "line_snapshots"
    __table_args__ = (
        UniqueConstraint("game_date", "player_name", "market_key", "direction", name="uq_line_snapshot"),
        Index("ix_line_game_date", "game_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    game_date: Mapped[date] = mapped_column(Date, nullable=False)
    player_name: Mapped[str] = mapped_column(String(120), nullable=False)
    market_key: Mapped[str] = mapped_column(String(60), nullable=False)
    direction: Mapped[str] = mapped_column(String(10), nullable=False)

    line_opened: Mapped[float] = mapped_column(Float, nullable=False)
    line_current: Mapped[float] = mapped_column(Float, nullable=False)

    @property
    def movement(self) -> float:
        return round(self.line_current - self.line_opened, 1)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class LineHistory(Base):
    """Série temporal da linha — um ponto por prop por rodada de análise.

    Diferente de LineSnapshot (que guarda só abertura+atual via upsert), esta
    tabela é APPEND-ONLY: cada run do worker acrescenta um ponto com timestamp,
    permitindo desenhar o movimento intraday da linha (não só o delta).
    """

    __tablename__ = "line_history"
    __table_args__ = (
        Index("ix_line_hist_lookup", "game_date", "player_name", "market_key", "direction", "captured_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    game_date: Mapped[date] = mapped_column(Date, nullable=False)
    player_name: Mapped[str] = mapped_column(String(120), nullable=False)
    market_key: Mapped[str] = mapped_column(String(60), nullable=False)
    direction: Mapped[str] = mapped_column(String(10), nullable=False)

    line: Mapped[float] = mapped_column(Float, nullable=False)
    odd_decimal: Mapped[float] = mapped_column(Float, nullable=False, server_default="0")

    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
