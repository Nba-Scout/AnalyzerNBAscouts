from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Player(Base):
    """Jogadores ativos da NBA (filtro: só ativos, 10 temporadas de histórico)."""

    __tablename__ = "players"
    __table_args__ = (
        # pg_trgm usado para fuzzy search por nome
        Index("ix_players_normalized_name_trgm", "normalized_name",
              postgresql_using="gin",
              postgresql_ops={"normalized_name": "gin_trgm_ops"}),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    # IDs nas fontes externas
    nba_api_id: Mapped[int | None] = mapped_column(unique=True, nullable=True)
    espn_id: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    # Time atual
    team_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id"), nullable=True)
    team: Mapped[object] = relationship("Team", lazy="select")
    # Metadados
    position: Mapped[str | None] = mapped_column(String(10), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    game_logs: Mapped[list] = relationship(
        "PlayerGameLog", back_populates="player", lazy="dynamic"
    )
    sync_state: Mapped[object | None] = relationship(
        "SyncState", back_populates="player", uselist=False, lazy="select"
    )
