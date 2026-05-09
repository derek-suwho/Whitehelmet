"""Add assigned_to_user_id to template_assignments for per-member targeting

Revision ID: d1e2f3a4b5c6
Revises: 51121d343d29, c1d2e3f4a5b6
Create Date: 2026-04-29

"""
from alembic import op
import sqlalchemy as sa

revision = 'd1e2f3a4b5c6'
down_revision = ('51121d343d29', 'c1d2e3f4a5b6')
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE template_assignments ADD COLUMN IF NOT EXISTS assigned_to_user_id VARCHAR(36)")


def downgrade():
    with op.batch_alter_table('template_assignments') as batch_op:
        batch_op.drop_column('assigned_to_user_id')
