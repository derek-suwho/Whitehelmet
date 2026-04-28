"""TemplateAssignment — links a template version to a DevCo org for a submission period."""

import uuid
from sqlalchemy import Column, String, DateTime, Text, func

from app.db.session import Base


class TemplateAssignment(Base):
    __tablename__ = "template_assignments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    template_version_id = Column(String(36), nullable=True)
    org_id = Column(String(36), nullable=False, index=True)
    assigned_by = Column(String(36), nullable=True)
    deadline = Column(DateTime, nullable=True)
    submission_type = Column(String(10), nullable=False, default="template")  # template | freeform
    instructions = Column(Text, nullable=True)
    status = Column(String(10), nullable=False, default="pending")  # pending | submitted | locked
    upload_token = Column(String(255), nullable=True, unique=True)
    upload_token_expires_at = Column(DateTime, nullable=True)
    assigned_at = Column(DateTime, server_default=func.now(), nullable=False)
