"""add line_opened to analyzed_props

Revision ID: b1c2d3e4f5a6
Revises: a3855278d889
Create Date: 2026-06-11 16:30:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: str | None = 'a3855278d889'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Linha de abertura do dia (de line_snapshots); line_movement = line - line_opened.
    # Nullable: snapshots antigos não têm o dado; o read path faz fallback para r.line.
    op.add_column('analyzed_props', sa.Column('line_opened', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('analyzed_props', 'line_opened')
