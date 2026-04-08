"""Auth routes — login, logout, current user."""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import get_current_user
from app.core.security import generate_session_token, generate_csrf_token, session_expiry
from app.db.session import get_db
from app.models.session import SessionModel
from app.models.user import User
from app.schemas.auth import LoginRequest, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
async def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """
    Authenticate against Whitehelmet's external auth service.

    TODO: Replace stub with actual auth service integration once
    auth system type is confirmed (OAuth2/SAML/LDAP).
    """
    settings = get_settings()

    # --- STUB: Replace with real auth service call ---
    # Example: POST {settings.auth_service_url}/validate
    # with credentials, get back user info
    #
    # For now, reject all logins until auth is integrated
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Auth service integration pending — awaiting auth system type confirmation",
    )
    # --- END STUB ---

    # After successful auth validation, this is how session creation works:
    # user = db.query(User).filter(User.external_id == external_user_id).first()
    # if not user:
    #     user = User(external_id=..., email=..., display_name=...)
    #     db.add(user)
    #     db.commit()
    #     db.refresh(user)
    #
    # token = generate_session_token()
    # session = SessionModel(token=token, user_id=user.id, expires_at=session_expiry())
    # db.add(session)
    # db.commit()
    #
    # response.set_cookie(
    #     key="session_id",
    #     value=token,
    #     httponly=True,
    #     secure=True,
    #     samesite="strict",
    #     max_age=settings.session_expiry_hours * 3600,
    # )
    # csrf = generate_csrf_token(token)
    # return {"user": UserResponse.model_validate(user), "csrf_token": csrf}


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


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    """Return current authenticated user."""
    return user
