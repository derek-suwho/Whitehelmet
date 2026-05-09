"""Profile model — synced from Supabase auth.users via Supabase Auth."""

from sqlalchemy import Column, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID

from app.db.session import Base


class Profile(Base):
    __tablename__ = "profiles"

    # id mirrors auth.users.id — set by Supabase Auth, never generated here
    id = Column(UUID(as_uuid=False), primary_key=True)
    email = Column(String(255), nullable=True, unique=True)
    org_id = Column(UUID(as_uuid=False), nullable=True, index=True)
    role = Column(String(50), nullable=False)  # org_super_admin | org_admin | org_member | subcontractor
    display_name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
