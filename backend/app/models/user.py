"""User model — synced from Whitehelmet's external auth system."""

from sqlalchemy import Column, Integer, String, DateTime, func

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    external_id = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False)
    display_name = Column(String(255), nullable=False)
    # Nullable — only set for local email/password auth; null for SSO users (Keycloak)
    password_hash = Column(String(255), nullable=True)
    role = Column(String(50), nullable=True)  # org_super_admin | org_admin | org_member
    org_id = Column(String(36), nullable=True, index=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
