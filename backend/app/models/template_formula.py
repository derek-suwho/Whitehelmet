"""TemplateFormula — Excel-style formula attached to a template version, applied on submission."""

import uuid

from sqlalchemy import Column, DateTime, Float, String, Text, func

from app.db.session import Base


class TemplateFormula(Base):
    __tablename__ = "template_formulas"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    template_version_id = Column(String(36), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    target_column = Column(String(10), nullable=False)
    formula_type = Column(String(20), nullable=False, default="column")
    expression = Column(String(500), nullable=False)
    weight = Column(Float, nullable=True)
    benchmark = Column(Float, nullable=True)
    scoring_rules = Column(Text, nullable=True)
    created_by = Column(String(36), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
