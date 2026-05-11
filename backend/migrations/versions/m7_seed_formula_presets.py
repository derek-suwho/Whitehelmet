"""seed Safety KPI formula presets as library items

Revision ID: m7_seed_formulas
Revises: d8ea9f9fc205
Create Date: 2026-05-10
"""
from alembic import op
import uuid

revision = "m7_seed_formulas"
down_revision = "d8ea9f9fc205"
branch_labels = None
depends_on = None

PRESETS = [
    {"name": "Fatality Rate (FR)", "expression": "fatalities * 200000 / manhours", "params": '["fatalities", "manhours"]', "desc": "Fatality Rate per 200,000 manhours. Weight: 0.20", "formula_type": "calculation"},
    {"name": "LTIFR", "expression": "lti * 200000 / manhours", "params": '["lti", "manhours"]', "desc": "Lost Time Injury Frequency Rate. Weight: 0.10", "formula_type": "calculation"},
    {"name": "TRIR", "expression": "recordable_incidents * 200000 / manhours", "params": '["recordable_incidents", "manhours"]', "desc": "Total Recordable Incident Rate. Weight: 0.10", "formula_type": "calculation"},
    {"name": "Near Miss Rate", "expression": "near_misses * 200000 / manhours", "params": '["near_misses", "manhours"]', "desc": "Near Miss Rate per 200,000 manhours. Weight: 0.15", "formula_type": "calculation"},
    {"name": "Safety Observation Rate", "expression": "observations * 200000 / manhours", "params": '["observations", "manhours"]', "desc": "Safety Observation Rate. Weight: 0.15", "formula_type": "calculation"},
    {"name": "Leadership Engagement Rate", "expression": "walks * 200000 / manhours", "params": '["walks", "manhours"]', "desc": "Leadership Walk Rate. Weight: 0.15", "formula_type": "calculation"},
    {"name": "Incentive Programs Rate", "expression": "rewards * 200000 / manhours", "params": '["rewards", "manhours"]', "desc": "Incentive Programs Rate. Weight: 0.15", "formula_type": "calculation"},
]


def upgrade():
    for p in PRESETS:
        op.execute(
            f"""INSERT INTO formulas (id, name, expression, parameters, description, formula_type, is_library_item, usage_count, created_at, updated_at)
            VALUES ('{str(uuid.uuid4())}', '{p["name"]}', '{p["expression"]}', '{p["params"]}', '{p["desc"]}', '{p["formula_type"]}', TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"""
        )


def downgrade():
    op.execute("DELETE FROM formulas WHERE is_library_item = 1")
