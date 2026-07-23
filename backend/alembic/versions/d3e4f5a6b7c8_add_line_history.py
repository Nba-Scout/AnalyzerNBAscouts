"""add line_history table (série temporal da linha)

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-07-22 21:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d3e4f5a6b7c8"
down_revision: str | None = "c2d3e4f5a6b7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Tabela append-only: um ponto por prop por rodada de análise (movimento
    # intraday da linha). Sem unique constraint — cada run acrescenta um ponto.
    op.create_table(
        "line_history",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("game_date", sa.Date(), nullable=False),
        sa.Column("player_name", sa.String(length=120), nullable=False),
        sa.Column("market_key", sa.String(length=60), nullable=False),
        sa.Column("direction", sa.String(length=10), nullable=False),
        sa.Column("line", sa.Float(), nullable=False),
        sa.Column("odd_decimal", sa.Float(), server_default="0", nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_line_hist_lookup",
        "line_history",
        ["game_date", "player_name", "market_key", "direction", "captured_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_line_hist_lookup", table_name="line_history")
    op.drop_table("line_history")
