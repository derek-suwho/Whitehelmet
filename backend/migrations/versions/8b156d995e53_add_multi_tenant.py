"""add_multi_tenant

Revision ID: 8b156d995e53
Revises: 93be113401bf
Create Date: 2026-04-23 10:51:57.163295
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '8b156d995e53'
down_revision: Union[str, None] = '93be113401bf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'organizations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('external_id', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('slug', sa.String(length=100), nullable=False),
        sa.Column('parent_org_id', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['parent_org_id'], ['organizations.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_organizations_external_id'), 'organizations', ['external_id'], unique=True)
    op.create_index(op.f('ix_organizations_parent_org_id'), 'organizations', ['parent_org_id'], unique=False)
    op.create_index(op.f('ix_organizations_slug'), 'organizations', ['slug'], unique=True)

    op.create_table(
        'org_memberships',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('org_id', sa.Integer(), nullable=False),
        sa.Column('system_role', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'org_id', name='uq_user_org'),
    )
    op.create_index(op.f('ix_org_memberships_org_id'), 'org_memberships', ['org_id'], unique=False)
    op.create_index(op.f('ix_org_memberships_user_id'), 'org_memberships', ['user_id'], unique=False)

    op.add_column('records', sa.Column('org_id', sa.Integer(), nullable=False))
    op.create_foreign_key('fk_records_org_id', 'records', 'organizations', ['org_id'], ['id'], ondelete='CASCADE')
    op.create_index(op.f('ix_records_org_id'), 'records', ['org_id'], unique=False)

    op.add_column('uploaded_files', sa.Column('org_id', sa.Integer(), nullable=False))
    op.create_foreign_key('fk_uploaded_files_org_id', 'uploaded_files', 'organizations', ['org_id'], ['id'], ondelete='CASCADE')
    op.create_index(op.f('ix_uploaded_files_org_id'), 'uploaded_files', ['org_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_uploaded_files_org_id'), table_name='uploaded_files')
    op.drop_constraint('fk_uploaded_files_org_id', 'uploaded_files', type_='foreignkey')
    op.drop_column('uploaded_files', 'org_id')

    op.drop_index(op.f('ix_records_org_id'), table_name='records')
    op.drop_constraint('fk_records_org_id', 'records', type_='foreignkey')
    op.drop_column('records', 'org_id')

    op.drop_index(op.f('ix_org_memberships_user_id'), table_name='org_memberships')
    op.drop_index(op.f('ix_org_memberships_org_id'), table_name='org_memberships')
    op.drop_table('org_memberships')

    op.drop_index(op.f('ix_organizations_slug'), table_name='organizations')
    op.drop_index(op.f('ix_organizations_parent_org_id'), table_name='organizations')
    op.drop_index(op.f('ix_organizations_external_id'), table_name='organizations')
    op.drop_table('organizations')
