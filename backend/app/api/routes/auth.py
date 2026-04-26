"""Auth routes — login, logout, register, current user."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from typing import Any
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import get_current_user
from app.core.security import (
    generate_session_token, generate_csrf_token, session_expiry,
    hash_password, verify_password,
)
from app.db.session import get_db
from app.models.session import SessionModel
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """Create a new local email/password account."""
    if get_settings().auth_mode == "keycloak":
        raise HTTPException(status_code=404, detail="Not available in SSO mode")
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        external_id=str(uuid.uuid4()),
        email=body.email,
        display_name=body.display_name,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login")
async def login(body: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    """Authenticate with email and password."""
    from app.core.rate_limit import check_rate_limit, record_failed_attempt

    ip = request.client.host if request.client else "unknown"
    allowed, remaining = check_rate_limit(ip)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many login attempts. Try again in {remaining} seconds.",
            headers={"Retry-After": str(remaining)},
        )

    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        record_failed_attempt(ip)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    settings = get_settings()
    token = generate_session_token()
    session = SessionModel(token=token, user_id=user.id, expires_at=session_expiry())
    db.add(session)
    db.commit()

    response.set_cookie(
        key="session_id",
        value=token,
        httponly=True,
        secure=settings.environment != "dev",
        samesite="strict",
        max_age=settings.session_expiry_hours * 3600,
    )
    csrf = generate_csrf_token(token)
    return {"user": UserResponse.model_validate(user), "csrf_token": csrf}


@router.post("/logout")
async def logout(
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Destroy session and clear cookie."""
    from fastapi import Request

    # Delete all sessions for this user (logout everywhere)
    db.query(SessionModel).filter(SessionModel.user_id == user.id).delete()
    db.commit()

    response.delete_cookie("session_id")
    return {"status": "logged_out"}


def _user_payload(usr: User | dict[str, Any]) -> dict:
    if isinstance(usr, dict):
        return {
            "id": int(usr["id"]) if usr.get("id") is not None else 0,
            "external_id": str(usr.get("external_id", "")),
            "email": str(usr.get("email", "")),
            "display_name": str(usr.get("display_name", "")),
            "role": usr.get("system_role"),
            "org_id": usr.get("org_external_id"),
        }
    return {
        "id": usr.id,
        "external_id": usr.external_id,
        "email": usr.email,
        "display_name": usr.display_name,
        "role": usr.role,
        "org_id": usr.org_id,
    }


@router.get("/me")
async def me(request: Request, current_user=Depends(get_current_user)):
    """Return current user and CSRF token (cookie session or SSO)."""
    session_token = request.cookies.get("session_id", "")
    csrf = generate_csrf_token(session_token)
    return {"user": _user_payload(current_user), "csrf_token": csrf}
