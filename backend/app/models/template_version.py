"""TemplateVersion model — immutable snapshots of a template's column schema."""

import uuid
from sqlalchemy import Column, String, Integer, DateTime, Text, func

from app.db.session import Base


class TemplateVersion(Base):
    __tablename__ = "template_versions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String(36), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    schema_json = Column(Text, nullable=False)   # JSON string of SchemaJson
    created_by = Column(String(36), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
