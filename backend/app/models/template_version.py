"""TemplateVersion — immutable snapshots of a template's column schema."""

import uuid
from sqlalchemy import Column, String, Integer, DateTime, Text, func, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.db.session import Base


class TemplateVersion(Base):
    __tablename__ = "template_versions"
    __table_args__ = (UniqueConstraint("template_id", "version_number"),)

    id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(UUID(as_uuid=False), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    schema_json = Column(Text, nullable=False)
    created_by = Column(UUID(as_uuid=False), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
