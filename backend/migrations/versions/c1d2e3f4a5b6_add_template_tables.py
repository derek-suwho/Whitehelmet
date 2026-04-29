"""add template, template_version, and consolidated_sheet tables

Revision ID: c1d2e3f4a5b6
Revises: a1b2c3d4e5f6
Create Date: 2026-04-28

"""
from alembic import op
import sqlalchemy as sa

revision = 'c1d2e3f4a5b6'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'templates',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('created_by', sa.String(36), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'template_versions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('template_id', sa.String(36), nullable=False, index=True),
        sa.Column('version_number', sa.Integer, nullable=False),
        sa.Column('schema_json', sa.Text, nullable=False),
        sa.Column('created_by', sa.String(36), nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_template_versions_template_id', 'template_versions', ['template_id'])

    op.create_table(
        'consolidated_sheets',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('template_id', sa.String(36), nullable=False, index=True),
        sa.Column('file_path', sa.String(500), nullable=False),
        sa.Column('generated_by', sa.String(36), nullable=True),
        sa.Column('generated_at', sa.DateTime, server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_consolidated_sheets_template_id', 'consolidated_sheets', ['template_id'])


def downgrade() -> None:
    op.drop_index('ix_consolidated_sheets_template_id', table_name='consolidated_sheets')
    op.drop_table('consolidated_sheets')
    op.drop_index('ix_template_versions_template_id', table_name='template_versions')
    op.drop_table('template_versions')
    op.drop_table('templates')
