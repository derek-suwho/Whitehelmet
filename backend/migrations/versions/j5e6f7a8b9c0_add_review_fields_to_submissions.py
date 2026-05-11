"""Add review fields to submissions table.

Revision ID: j5e6f7a8b9c0
Revises: i4d5e6f7a8b9
Create Date: 2026-05-10 00:00:00.000000
"""

from typing import Optional

import sqlalchemy as sa
from alembic import op

revision = "j5e6f7a8b9c0"
down_revision: Optional[str] = "i4d5e6f7a8b9"
branch_labels: Optional[str] = None
depends_on: Optional[str] = None


def upgrade() -> None:
    conn = op.get_bind()

    existing = [
        r[0]
        for r in conn.execute(
            sa.text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='submissions'"
            )
        )
    ]

    if "review_status" not in existing:
        conn.execute(sa.text(
            "ALTER TABLE submissions ADD COLUMN review_status VARCHAR(20)"
        ))

    if "review_comment" not in existing:
        conn.execute(sa.text(
            "ALTER TABLE submissions ADD COLUMN review_comment TEXT"
        ))

    if "reviewed_by" not in existing:
        conn.execute(sa.text(
            "ALTER TABLE submissions ADD COLUMN reviewed_by VARCHAR(36)"
        ))

    if "reviewed_at" not in existing:
        conn.execute(sa.text(
            "ALTER TABLE submissions ADD COLUMN reviewed_at TIMESTAMP"
        ))


def downgrade() -> None:
    conn = op.get_bind()
    for col in ("review_status", "review_comment", "reviewed_by", "reviewed_at"):
        conn.execute(sa.text(f"ALTER TABLE submissions DROP COLUMN IF EXISTS {col}"))
