"""Widen submissions.status from VARCHAR(10) to VARCHAR(20).

Revision ID: k6f7a8b9c0d1
Revises: j5e6f7a8b9c0
Create Date: 2026-05-10 00:00:00.000000
"""

from typing import Optional

import sqlalchemy as sa
from alembic import op

revision = "k6f7a8b9c0d1"
down_revision: Optional[str] = "j5e6f7a8b9c0"
branch_labels: Optional[str] = None
depends_on: Optional[str] = None


def upgrade() -> None:
    op.get_bind().execute(sa.text(
        "ALTER TABLE submissions ALTER COLUMN status TYPE varchar(20)"
    ))


def downgrade() -> None:
    op.get_bind().execute(sa.text(
        "ALTER TABLE submissions ALTER COLUMN status TYPE varchar(10)"
    ))
