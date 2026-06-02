from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SyncState(Base):
    """Watermark do backfill / incremental por jogador.

    Registra o último game_date sincronizado para cada jogador,
    permitindo ao worker buscar apenas os jogos novos (incremental)
    e ao lazy-refresh saber se os dados estão "velhos".
    """

    __tablename__ = "sync_states"

    id: Mapped[int] = mapped_column(primary_key=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), unique=True, nullable=False)
    player: Mapped[object] = relationship("Player", back_populates="sync_state")

    last_game_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    seasons_backfilled: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[str | None] = mapped_column(String(20), nullable=True)  # "kaggle" | "nba_api"
    status: Mapped[str] = mapped_column(String(20), default="pending")     # pending | ok | error
