"""ConsolidatedSheet — the output of a consolidation run for a template."""

import uuid
from sqlalchemy import Column, String, DateTime, func

from app.db.session import Base


class ConsolidatedSheet(Base):
    __tablename__ = "consolidated_sheets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String(36), nullable=False, index=True)
    file_path = Column(String(500), nullable=False)
    generated_by = Column(String(36), nullable=True)
    generated_at = Column(DateTime, server_default=func.now(), nullable=False)
