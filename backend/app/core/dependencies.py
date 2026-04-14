"""FastAPI dependencies for auth, DB sessions, rate limiting."""

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.session import SessionModel
from app.models.user import User
from datetime import datetime, timezone


async def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """Extract and validate session from httpOnly cookie."""
    session_token = request.cookies.get("session_id")
    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    session = (
        db.query(SessionModel)
        .filter(
            SessionModel.token == session_token,
            SessionModel.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid",
        )

    user = db.query(User).filter(User.id == session.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


async def verify_csrf(request: Request) -> None:
    """Verify CSRF token on state-mutating requests."""
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return

    from app.core.security import verify_csrf_token

    session_token = request.cookies.get("session_id")
    csrf_token = request.headers.get("X-CSRF-Token")

    if not session_token or not csrf_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF validation failed",
        )

    if not verify_csrf_token(session_token, csrf_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token mismatch",
        )
