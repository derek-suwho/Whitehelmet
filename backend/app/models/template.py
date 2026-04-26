from sqlalchemy import Column, String, DateTime, func

from app.db.session import Base


class Template(Base):
    __tablename__ = "templates"

    id = Column(String(36), primary_key=True)
    name = Column(String(255), nullable=False)
    created_by = Column(String(36), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
