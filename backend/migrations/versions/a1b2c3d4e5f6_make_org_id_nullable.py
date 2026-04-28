"""make org_id nullable on records and uploaded_files

Revision ID: a1b2c3d4e5f6
Revises: 8b156d995e53
Create Date: 2026-04-23

"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = '8b156d995e53'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('records') as batch_op:
        batch_op.alter_column('org_id', existing_type=sa.Integer(), nullable=True)
    with op.batch_alter_table('uploaded_files') as batch_op:
        batch_op.alter_column('org_id', existing_type=sa.Integer(), nullable=True)


def downgrade():
    with op.batch_alter_table('uploaded_files') as batch_op:
        batch_op.alter_column('org_id', existing_type=sa.Integer(), nullable=False)
    with op.batch_alter_table('records') as batch_op:
        batch_op.alter_column('org_id', existing_type=sa.Integer(), nullable=False)
