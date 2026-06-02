from __future__ import annotations

from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Game(Base):
    """Partida NBA — mandante/visitante, placar, temporada."""

    __tablename__ = "games"
    __table_args__ = (
        Index("ix_games_date", "game_date"),
        Index("ix_games_season", "season"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # IDs externos
    nba_api_game_id: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    espn_event_id: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)

    game_date: Mapped[date] = mapped_column(Date, nullable=False)
    season: Mapped[str] = mapped_column(String(10), nullable=False)  # ex: "2024-25"
    season_type: Mapped[str] = mapped_column(String(20), default="Regular Season")  # Regular Season | Playoffs

    home_team_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id"), nullable=True)
    away_team_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id"), nullable=True)

    home_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    away_score: Mapped[int | None] = mapped_column(Integer, nullable=True)

    is_playoff: Mapped[bool] = mapped_column(Boolean, default=False)

    player_logs: Mapped[list] = relationship("PlayerGameLog", back_populates="game", lazy="dynamic")
