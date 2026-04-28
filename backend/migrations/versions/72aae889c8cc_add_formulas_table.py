"""add formulas table

Revision ID: 72aae889c8cc
Revises: 93be113401bf
Create Date: 2026-04-27 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '72aae889c8cc'
down_revision: Union[str, None] = '93be113401bf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'formulas',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('expression', sa.String(1000), nullable=False),
        sa.Column('nl_prompt', sa.String(500), nullable=True),
        sa.Column('formula_type', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_formulas_user_id', 'formulas', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_formulas_user_id', table_name='formulas')
    op.drop_table('formulas')
