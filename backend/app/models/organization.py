"""Organization model — PIF (root) and DevCo (member) tenants."""

import uuid
from sqlalchemy import Column, String, DateTime, func

from app.db.session import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    type = Column(String(10), nullable=False)  # pif | devco
    parent_org_id = Column(String(36), nullable=True, index=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
