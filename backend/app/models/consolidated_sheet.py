"""ConsolidatedSheet — the output of a consolidation run for a template."""

import uuid
from sqlalchemy import Column, String, DateTime, func

from app.db.session import Base


class ConsolidatedSheet(Base):
    __tablename__ = "consolidated_sheets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String(36), nullable=False, index=True)
    project_id = Column(String(36), nullable=True, index=True)
    name = Column(String(255), nullable=True)      # human label e.g. "July 2026 Report"
    period = Column(String(50), nullable=True)      # machine label e.g. "2026-07"
    file_path = Column(String(500), nullable=False)
    generated_by = Column(String(36), nullable=True)
    generated_at = Column(DateTime, server_default=func.now(), nullable=False)
