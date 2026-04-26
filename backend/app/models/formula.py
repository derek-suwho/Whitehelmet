"""Formula library model — user-saved reusable spreadsheet formulas."""

from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func

from app.db.session import Base


class Formula(Base):
    __tablename__ = "formulas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(String(500), nullable=True)
    expression = Column(String(1000), nullable=False)
    nl_prompt = Column(String(500), nullable=True)
    formula_type = Column(String(50), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
