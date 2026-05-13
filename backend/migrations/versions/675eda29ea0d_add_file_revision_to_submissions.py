"""add file_revision to submissions

Revision ID: 675eda29ea0d
Revises: m7_seed_formulas
Create Date: 2026-05-11 22:20:42.503893
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '675eda29ea0d'
down_revision: Union[str, None] = 'm7_seed_formulas'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('submissions', sa.Column('file_revision', sa.Integer(), server_default='0', nullable=False))

    op.execute("CREATE INDEX IF NOT EXISTS ix_submissions_reporting_period ON submissions (reporting_period)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_template_assignments_assigned_to_user_id ON template_assignments (assigned_to_user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_template_assignments_reporting_period ON template_assignments (reporting_period)")


def downgrade() -> None:
    op.drop_index('ix_template_assignments_reporting_period', table_name='template_assignments')
    op.drop_index('ix_template_assignments_assigned_to_user_id', table_name='template_assignments')
    op.drop_index('ix_submissions_reporting_period', table_name='submissions')
    op.drop_column('submissions', 'file_revision')
