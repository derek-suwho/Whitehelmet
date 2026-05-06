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
    op.execute("""
        CREATE TABLE IF NOT EXISTS formulas (
            id SERIAL NOT NULL,
            user_id INTEGER NOT NULL,
            name VARCHAR(200) NOT NULL,
            description VARCHAR(500),
            expression VARCHAR(1000) NOT NULL,
            nl_prompt VARCHAR(500),
            formula_type VARCHAR(50),
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
            PRIMARY KEY (id),
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_formulas_user_id ON formulas (user_id)")


def downgrade() -> None:
    op.drop_index('ix_formulas_user_id', table_name='formulas')
    op.drop_table('formulas')
