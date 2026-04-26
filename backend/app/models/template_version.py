from sqlalchemy import Column, String, Integer, Text, DateTime, func

from app.db.session import Base


class TemplateVersion(Base):
    __tablename__ = "template_versions"

    id = Column(String(36), primary_key=True)
    template_id = Column(String(36), nullable=False, index=True)
    version_number = Column(Integer, nullable=False, default=1)
    schema_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
