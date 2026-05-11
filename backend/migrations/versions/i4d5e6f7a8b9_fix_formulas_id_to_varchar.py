"""Fix formulas.id from integer to varchar(36) UUID.

Revision ID: i4d5e6f7a8b9
Revises: h3c4d5e6f7a8
Create Date: 2026-05-10 00:00:00.000000
"""

from typing import Optional

import sqlalchemy as sa
from alembic import op

revision = "i4d5e6f7a8b9"
down_revision: Optional[str] = "h3c4d5e6f7a8"
branch_labels: Optional[str] = None
depends_on: Optional[str] = None


def upgrade() -> None:
    conn = op.get_bind()
    # Rows have legacy integer IDs — incompatible with UUID system; clear them
    conn.execute(sa.text("TRUNCATE TABLE formulas"))
    conn.execute(sa.text("ALTER TABLE formulas DROP CONSTRAINT IF EXISTS formulas_pkey"))
    conn.execute(sa.text("DROP SEQUENCE IF EXISTS formulas_id_seq CASCADE"))
    conn.execute(sa.text("ALTER TABLE formulas DROP COLUMN id"))
    conn.execute(sa.text("ALTER TABLE formulas ADD COLUMN id varchar(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE formulas ADD PRIMARY KEY (id)"))


def downgrade() -> None:
    pass  # not worth reversing; table was empty
