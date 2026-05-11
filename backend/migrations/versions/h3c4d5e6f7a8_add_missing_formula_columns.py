"""Add is_library_item and usage_count to formulas table.

Revision ID: h3c4d5e6f7a8
Revises: g2b3c4d5e6f7
Create Date: 2026-05-10 00:00:00.000000
"""

from typing import Optional

import sqlalchemy as sa
from alembic import op

revision = "h3c4d5e6f7a8"
down_revision: Optional[str] = "g2b3c4d5e6f7"
branch_labels: Optional[str] = None
depends_on: Optional[str] = None


def upgrade() -> None:
    conn = op.get_bind()
    cols = [r[0] for r in conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns WHERE table_name='formulas'"
    ))]
    if "is_library_item" not in cols:
        op.add_column("formulas", sa.Column(
            "is_library_item", sa.Boolean(), nullable=False, server_default=sa.false()
        ))
    if "usage_count" not in cols:
        op.add_column("formulas", sa.Column(
            "usage_count", sa.Integer(), nullable=False, server_default=sa.text("0")
        ))


def downgrade() -> None:
    op.drop_column("formulas", "usage_count")
    op.drop_column("formulas", "is_library_item")
