"""Add file_path to template_versions.

Revision ID: l7g8h9i0j1k2
Revises: k6f7a8b9c0d1
Create Date: 2026-05-10 00:00:00.000000
"""

from typing import Optional

import sqlalchemy as sa
from alembic import op

revision = "l7g8h9i0j1k2"
down_revision: Optional[str] = "k6f7a8b9c0d1"
branch_labels: Optional[str] = None
depends_on: Optional[str] = None


def upgrade() -> None:
    op.get_bind().execute(sa.text(
        "ALTER TABLE template_versions ADD COLUMN IF NOT EXISTS file_path VARCHAR(500)"
    ))


def downgrade() -> None:
    op.get_bind().execute(sa.text(
        "ALTER TABLE template_versions DROP COLUMN IF EXISTS file_path"
    ))
