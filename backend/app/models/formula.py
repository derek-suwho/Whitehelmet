# backend/app/models/formula.py
"""Formula library — PIF-owned reusable calculation formulas."""

import uuid

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, func

from app.db.session import Base


class Formula(Base):
    __tablename__ = "formulas"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    nl_prompt = Column(Text, nullable=True)
    expression = Column(Text, nullable=False)
    formula_type = Column(String(50), nullable=False, default="calculation")
    is_library_item = Column(Boolean, nullable=False, default=False)
    created_by = Column(String(36), nullable=True, index=True)
    usage_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def __init__(self, **kwargs):
        kwargs.setdefault("is_library_item", False)
        kwargs.setdefault("usage_count", 0)
        super().__init__(**kwargs)
