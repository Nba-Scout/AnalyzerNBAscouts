from __future__ import annotations

from sqlalchemy import Float, ForeignKey, Index, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AnalyzedProp(Base):
    """Uma prop analisada — substitui partial_results.json.

    Campos derivados já materializados para leitura rápida pelo endpoint.
    """

    __tablename__ = "analyzed_props"
    __table_args__ = (
        Index("ix_props_snapshot", "snapshot_id"),
        Index("ix_props_player_market", "player_name", "market_key"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    snapshot_id: Mapped[int] = mapped_column(ForeignKey("analysis_snapshots.id"), nullable=False)
    snapshot: Mapped[object] = relationship("AnalysisSnapshot", back_populates="props")

    # Identificação
    player_name: Mapped[str] = mapped_column(String(120), nullable=False)
    team: Mapped[str] = mapped_column(String(5), default="")
    opponent: Mapped[str] = mapped_column(String(5), default="")
    market_key: Mapped[str] = mapped_column(String(60), nullable=False)
    market_label: Mapped[str] = mapped_column(String(40), default="")
    line: Mapped[float] = mapped_column(Float, nullable=False)
    direction: Mapped[str] = mapped_column(String(10), nullable=False)

    # Odds
    odd_decimal: Mapped[float] = mapped_column(Float, nullable=False)
    odd_implied_prob: Mapped[float] = mapped_column(Float, default=0.0)
    bookmaker: Mapped[str] = mapped_column(String(40), default="")
    all_odds: Mapped[list] = mapped_column(JSON, default=list)

    # Análise EV
    true_probability: Mapped[float] = mapped_column(Float, nullable=False)
    ev_percent: Mapped[float] = mapped_column(Float, nullable=False)
    kelly_fraction: Mapped[float] = mapped_column(Float, default=0.0)
    classification: Mapped[str] = mapped_column(String(10), nullable=False)

    # Stats derivadas (materializadas do data warehouse)
    avg_stat_last10: Mapped[float] = mapped_column(Float, default=0.0)
    games_over_line_pct: Mapped[float] = mapped_column(Float, default=0.0)
    last5_values: Mapped[list] = mapped_column(JSON, default=list)

    # Contexto
    def_rating_opponent: Mapped[float] = mapped_column(Float, default=0.0)
    pace: Mapped[float] = mapped_column(Float, default=0.0)
    minutes_avg: Mapped[float] = mapped_column(Float, default=0.0)
    projected_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_boost_pct: Mapped[float] = mapped_column(Float, default=0.0)
    dvp_rank: Mapped[int] = mapped_column(Integer, default=0)
    dvp_total: Mapped[int] = mapped_column(Integer, default=0)
    team_injuries: Mapped[list] = mapped_column(JSON, default=list)
