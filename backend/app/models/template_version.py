"""TemplateVersion — immutable snapshots of a template's column schema."""

import uuid

from sqlalchemy import String, Column, DateTime, Integer, Text, UniqueConstraint, func

from app.db.session import Base


class TemplateVersion(Base):
    __tablename__ = "template_versions"
    __table_args__ = (UniqueConstraint("template_id", "version_number"),)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String(36), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    schema_json = Column(Text, nullable=False)
    file_path = Column(String(500), nullable=True)   # uploaded xlsx source file
    created_by = Column(String(36), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
