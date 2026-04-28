"""Template model — versioned KPI template definitions owned by PIF."""

import uuid
from sqlalchemy import Column, String, DateTime, Text, func

from app.db.session import Base


class Template(Base):
    __tablename__ = "templates"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(String(36), nullable=True)
    status = Column(String(20), nullable=False, default="draft")  # draft | active | deprecated
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
