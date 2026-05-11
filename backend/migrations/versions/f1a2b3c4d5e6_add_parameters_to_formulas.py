"""Add parameters column to formulas table.

Revision ID: f1a2b3c4d5e6
Revises: e1f2a3b4c5d6
Create Date: 2026-05-10 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f1a2b3c4d5e6"
down_revision: str | None = "e1f2a3b4c5d6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("formulas") as batch_op:
        batch_op.add_column(sa.Column("parameters", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("formulas") as batch_op:
        batch_op.drop_column("parameters")
