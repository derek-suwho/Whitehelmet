"""merge_multi_tenant_and_formulas

Revision ID: 51121d343d29
Revises: 72aae889c8cc, 7bac4a8a6500
Create Date: 2026-04-28 15:15:30.235245
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '51121d343d29'
down_revision: Union[str, None] = ('72aae889c8cc', '7bac4a8a6500')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
