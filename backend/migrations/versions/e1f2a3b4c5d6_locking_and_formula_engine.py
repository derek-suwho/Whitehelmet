"""Add locking columns, processed_file_path, and template_formulas table

Revision ID: e1f2a3b4c5d6
Revises: d1e2f3a4b5c6
Create Date: 2026-05-05

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect as sa_inspect

revision = "e1f2a3b4c5d6"
down_revision = "d1e2f3a4b5c6"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    insp = sa_inspect(conn)

    # template_assignments: add locked_at, locked_by
    ta_cols = {c["name"] for c in insp.get_columns("template_assignments")}
    with op.batch_alter_table("template_assignments") as batch_op:
        if "locked_at" not in ta_cols:
            batch_op.add_column(sa.Column("locked_at", sa.DateTime(), nullable=True))
        if "locked_by" not in ta_cols:
            batch_op.add_column(sa.Column("locked_by", sa.String(36), nullable=True))

    # submissions: add processed_file_path
    sub_cols = {c["name"] for c in insp.get_columns("submissions")}
    with op.batch_alter_table("submissions") as batch_op:
        if "processed_file_path" not in sub_cols:
            batch_op.add_column(sa.Column("processed_file_path", sa.String(500), nullable=True))

    # template_formulas: new table (skip if already exists)
    if not insp.has_table("template_formulas"):
        op.create_table(
            "template_formulas",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("template_version_id", sa.String(36), nullable=False, index=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("target_column", sa.String(10), nullable=False),
            sa.Column("formula_type", sa.String(20), nullable=False),
            sa.Column("expression", sa.String(500), nullable=False),
            sa.Column("weight", sa.Float(), nullable=True),
            sa.Column("benchmark", sa.Float(), nullable=True),
            sa.Column("scoring_rules", sa.Text(), nullable=True),
            sa.Column("created_by", sa.String(36), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )


def downgrade():
    op.drop_table("template_formulas")
    with op.batch_alter_table("submissions") as batch_op:
        batch_op.drop_column("processed_file_path")
    with op.batch_alter_table("template_assignments") as batch_op:
        batch_op.drop_column("locked_by")
        batch_op.drop_column("locked_at")
