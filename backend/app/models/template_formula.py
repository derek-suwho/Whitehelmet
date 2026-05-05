"""TemplateFormula — Excel-style formula attached to a template version, applied on submission."""

import uuid
from sqlalchemy import Column, String, Float, Text, DateTime, func

from app.db.session import Base


class TemplateFormula(Base):
    __tablename__ = "template_formulas"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    template_version_id = Column(String(36), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    target_column = Column(String(10), nullable=False)   # column letter e.g. "E"
    formula_type = Column(String(20), nullable=False, default="column")  # column | single_cell
    expression = Column(String(500), nullable=False)     # e.g. "=O{row}/N{row}" or "=SUM(A2:A100)"
    weight = Column(Float, nullable=True)
    benchmark = Column(Float, nullable=True)
    scoring_rules = Column(Text, nullable=True)          # JSON: [{"min": 0, "max": 0.01, "score": 90}]
    created_by = Column(String(36), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
