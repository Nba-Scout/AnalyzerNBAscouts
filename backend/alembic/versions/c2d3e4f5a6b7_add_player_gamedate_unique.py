"""add uq_player_gamedate for cross-source dedup

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-06-11 17:30:00.000000

"""
from collections.abc import Sequence

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c2d3e4f5a6b7'
down_revision: str | None = 'b1c2d3e4f5a6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Chave de dedup cross-source (Kaggle + ESPN): 1 jogo por (jogador, data).
    # Alvo do ON CONFLICT no pipeline de ingest.
    op.create_unique_constraint(
        "uq_player_gamedate", "player_game_logs", ["player_id", "game_date"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_player_gamedate", "player_game_logs", type_="unique")
