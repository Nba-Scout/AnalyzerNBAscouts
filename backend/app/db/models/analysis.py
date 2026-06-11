from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.prop import AnalyzedProp


class AnalysisSnapshot(Base):
    """Registro de cada execução de analyze_day().

    1 linha por run — status, contagens, quota usada, duração.
    """

    __tablename__ = "analysis_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    status: Mapped[str] = mapped_column(String(20), default="pending")
    # "pending" | "running" | "ok" | "demo" | "error"

    props_count: Mapped[int] = mapped_column(Integer, default=0)
    strong_count: Mapped[int] = mapped_column(Integer, default=0)
    games_count: Mapped[int] = mapped_column(Integer, default=0)
    quota_used: Mapped[int] = mapped_column(Integer, default=0)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_demo: Mapped[bool] = mapped_column(default=False)

    props: Mapped[list[AnalyzedProp]] = relationship("AnalyzedProp", back_populates="snapshot", lazy="select")
