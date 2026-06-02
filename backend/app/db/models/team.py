from __future__ import annotations

from sqlalchemy import JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Team(Base):
    """30 times da NBA com mapa de aliases e IDs das fontes."""

    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    abbreviation: Mapped[str] = mapped_column(String(5), unique=True, nullable=False)
    # IDs nas fontes externas
    nba_api_id: Mapped[int | None] = mapped_column(nullable=True)
    espn_id: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Aliases e abreviações alternativas (para fuzzy match)
    aliases: Mapped[list] = mapped_column(JSON, default=list)
    # Metadados
    conference: Mapped[str | None] = mapped_column(String(10), nullable=True)
    division: Mapped[str | None] = mapped_column(String(30), nullable=True)
