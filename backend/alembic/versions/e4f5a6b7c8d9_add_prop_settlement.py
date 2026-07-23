"""add settlement fields to analyzed_props (backtesting)

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-07-23 01:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e4f5a6b7c8d9"
down_revision: str | None = "d3e4f5a6b7c8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Liquidação da prop contra o resultado real (data warehouse):
    # actual_value = stat real do jogador no jogo; result = win/loss/push/void.
    # Alimenta o Backtesting Panel (/api/backtest).
    op.add_column("analyzed_props", sa.Column("actual_value", sa.Float(), nullable=True))
    op.add_column("analyzed_props", sa.Column("result", sa.String(length=10), nullable=True))
    op.add_column("analyzed_props", sa.Column("settled_at", sa.DateTime(timezone=True), nullable=True))
    # Parcial: só as não liquidadas são varridas pelo worker.
    op.create_index(
        "ix_props_unsettled",
        "analyzed_props",
        ["id"],
        postgresql_where=sa.text("result IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_props_unsettled", table_name="analyzed_props")
    op.drop_column("analyzed_props", "settled_at")
    op.drop_column("analyzed_props", "result")
    op.drop_column("analyzed_props", "actual_value")
