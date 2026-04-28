"""ProjectMember — links a user (subcontractor) to a project."""

import uuid
from sqlalchemy import Column, String, Integer, DateTime, func

from app.db.session import Base


class ProjectMember(Base):
    __tablename__ = "project_members"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    added_at = Column(DateTime, server_default=func.now(), nullable=False)
