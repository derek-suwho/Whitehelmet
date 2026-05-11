"""Replace formulas.user_id (int FK) with created_by (string UUID).

Revision ID: g2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-05-10 00:00:00.000000
"""

from collections.abc import Sequence
from typing import Optional

import sqlalchemy as sa
from alembic import op

revision = "g2b3c4d5e6f7"
down_revision: Optional[str] = "f1a2b3c4d5e6"
branch_labels: Optional[str] = None
depends_on: Optional[str] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Add created_by if not present
    cols = [r[0] for r in conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='formulas'"
    ))]
    if "created_by" not in cols:
        op.add_column("formulas", sa.Column("created_by", sa.String(36), nullable=True))
        op.create_index("ix_formulas_created_by", "formulas", ["created_by"])

    # Drop FK and index on user_id using IF EXISTS (no transaction abort)
    conn.execute(sa.text(
        "ALTER TABLE formulas DROP CONSTRAINT IF EXISTS formulas_user_id_fkey"
    ))
    conn.execute(sa.text(
        "DROP INDEX IF EXISTS ix_formulas_user_id"
    ))

    # Drop user_id if it still exists
    if "user_id" in cols:
        op.drop_column("formulas", "user_id")


def downgrade() -> None:
    op.drop_index("ix_formulas_created_by", table_name="formulas")
    op.drop_column("formulas", "created_by")
    op.add_column("formulas", sa.Column("user_id", sa.Integer(), nullable=True))
