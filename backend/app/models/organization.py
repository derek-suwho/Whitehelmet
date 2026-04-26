from sqlalchemy import Column, String, DateTime, func

from app.db.session import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String(36), primary_key=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
