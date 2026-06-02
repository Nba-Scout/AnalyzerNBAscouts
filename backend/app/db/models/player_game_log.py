from __future__ import annotations

from datetime import date

from sqlalchemy import Boolean, Date, Float, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PlayerGameLog(Base):
    """Tabela-fonte do data warehouse — 1 linha por jogador × jogo.

    Imutável após o jogo encerrar. Índice primário por (player_id, game_date).
    ~350k linhas para 10 temporadas, jogadores ativos (~100 MB).
    """

    __tablename__ = "player_game_logs"
    __table_args__ = (
        UniqueConstraint("player_id", "game_id", name="uq_player_game"),
        Index("ix_pgl_player_date", "player_id", "game_date"),
        Index("ix_pgl_season", "season"),
        Index("ix_pgl_player_season", "player_id", "season"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), nullable=False)
    game_id: Mapped[int | None] = mapped_column(ForeignKey("games.id"), nullable=True)

    player: Mapped[object] = relationship("Player", back_populates="game_logs")
    game: Mapped[object | None] = relationship("Game", back_populates="player_logs")

    game_date: Mapped[date] = mapped_column(Date, nullable=False)
    season: Mapped[str] = mapped_column(String(10), nullable=False)
    season_type: Mapped[str] = mapped_column(String(20), default="Regular Season")
    is_playoff: Mapped[bool] = mapped_column(Boolean, default=False)

    # Contexto do jogo
    home_away: Mapped[str | None] = mapped_column(String(5), nullable=True)   # "home" | "away"
    opponent_abbr: Mapped[str | None] = mapped_column(String(5), nullable=True)
    team_abbr: Mapped[str | None] = mapped_column(String(5), nullable=True)
    team_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    opp_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    margin: Mapped[int | None] = mapped_column(Integer, nullable=True)        # positivo = vitória

    # Stats tradicionais
    min_played: Mapped[float | None] = mapped_column(Float, nullable=True)
    pts: Mapped[float | None] = mapped_column(Float, nullable=True)
    reb: Mapped[float | None] = mapped_column(Float, nullable=True)
    ast: Mapped[float | None] = mapped_column(Float, nullable=True)
    fg3m: Mapped[float | None] = mapped_column(Float, nullable=True)
    blk: Mapped[float | None] = mapped_column(Float, nullable=True)
    stl: Mapped[float | None] = mapped_column(Float, nullable=True)
    tov: Mapped[float | None] = mapped_column(Float, nullable=True)
    fgm: Mapped[float | None] = mapped_column(Float, nullable=True)
    fga: Mapped[float | None] = mapped_column(Float, nullable=True)
    fg3a: Mapped[float | None] = mapped_column(Float, nullable=True)
    ftm: Mapped[float | None] = mapped_column(Float, nullable=True)
    fta: Mapped[float | None] = mapped_column(Float, nullable=True)
    oreb: Mapped[float | None] = mapped_column(Float, nullable=True)
    dreb: Mapped[float | None] = mapped_column(Float, nullable=True)
    pf: Mapped[float | None] = mapped_column(Float, nullable=True)
    plus_minus: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Combos derivados (materializados para queries rápidas)
    pra: Mapped[float | None] = mapped_column(Float, nullable=True)    # pts+reb+ast
    pr: Mapped[float | None] = mapped_column(Float, nullable=True)     # pts+reb
    pa: Mapped[float | None] = mapped_column(Float, nullable=True)     # pts+ast
    ra: Mapped[float | None] = mapped_column(Float, nullable=True)     # reb+ast
    stocks: Mapped[float | None] = mapped_column(Float, nullable=True) # blk+stl

    # Fonte dos dados (para auditoria)
    source: Mapped[str | None] = mapped_column(String(20), nullable=True)  # "kaggle" | "nba_api" | "espn"
