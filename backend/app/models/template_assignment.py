from sqlalchemy import Column, String, DateTime, Text, func

from app.db.session import Base


class TemplateAssignment(Base):
    __tablename__ = "template_assignments"

    id = Column(String(36), primary_key=True)
    template_version_id = Column(String(36), nullable=True, index=True)
    org_id = Column(String(36), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="pending")
    submission_type = Column(String(50), nullable=False, default="template")
    deadline = Column(DateTime, nullable=True)
    instructions = Column(Text, nullable=True)
    assigned_at = Column(DateTime, server_default=func.now(), nullable=False)
