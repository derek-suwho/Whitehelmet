"""FastAPI dependencies — ES256 JWT Bearer auth via Supabase JWKS."""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.jwks import decode_supabase_token
from app.db.session import get_db
from app.models.profile import Profile

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Profile:
    """Validate Supabase ES256 JWT and return the caller's Profile row."""
    if creds is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    settings = get_settings()
    claims = await decode_supabase_token(creds.credentials, settings.supabase_url)
    user_id: str = claims.get("sub", "")

    profile = db.query(Profile).filter(Profile.id == user_id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Profile not found")

    return profile


async def verify_csrf(request: Request) -> None:
    """No-op: CSRF not needed with Bearer token auth (no cookies)."""
    pass
