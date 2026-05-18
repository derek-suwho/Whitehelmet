"""Add header_row to template_versions.

Revision ID: n8_header_row
Revises: m7_seed_formulas
Create Date: 2026-05-18
"""
from typing import Optional

import sqlalchemy as sa
from alembic import op

revision = "n8_header_row"
down_revision = "m7_seed_formulas"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.get_bind().execute(sa.text(
        "ALTER TABLE template_versions ADD COLUMN IF NOT EXISTS header_row INTEGER DEFAULT NULL"
    ))


def downgrade() -> None:
    op.get_bind().execute(sa.text(
        "ALTER TABLE template_versions DROP COLUMN IF EXISTS header_row"
    ))
