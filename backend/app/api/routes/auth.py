"""Auth routes — /me only. Login/register handled by Supabase Auth."""

from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user
from app.models.profile import Profile
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me", response_model=UserResponse)
async def me(profile: Profile = Depends(get_current_user)):
    """Return the current user's profile (from validated Supabase JWT)."""
    return profile
