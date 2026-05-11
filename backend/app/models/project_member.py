"""ProjectMember — links a user (participant) to a project with a scoped role."""

import uuid

from sqlalchemy import Column, DateTime, String, func

from app.db.session import Base


class ProjectMember(Base):
    __tablename__ = "project_members"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), nullable=False, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    participant_role = Column(String(20), nullable=False, default="focal")
    added_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
