"""Profile model — synced from Supabase auth.users via Supabase Auth."""

from sqlalchemy import Column, String, DateTime, func
from sqlalchemy.types import Uuid

from app.db.session import Base


class Profile(Base):
    __tablename__ = "profiles"

    # id mirrors auth.users.id — set by Supabase Auth, never generated here
    id = Column(Uuid(as_uuid=False), primary_key=True)
    org_id = Column(Uuid(as_uuid=False), nullable=True, index=True)
    role = Column(String(50), nullable=False)      # pif_admin | devco_admin | devco_user
    display_name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
