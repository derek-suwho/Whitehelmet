"""add target_row and target_sheet to template_formulas

Revision ID: d8ea9f9fc205
Revises: l7g8h9i0j1k2
Create Date: 2026-05-10 23:50:26.542318
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'd8ea9f9fc205'
down_revision: Union[str, None] = 'l7g8h9i0j1k2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('template_formulas', sa.Column('target_row', sa.Integer(), nullable=True))
    op.add_column('template_formulas', sa.Column('target_sheet', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('template_formulas', 'target_sheet')
    op.drop_column('template_formulas', 'target_row')
