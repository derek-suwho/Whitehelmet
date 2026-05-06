"""Auth routes — /me only (Supabase Bearer JWT auth)."""

from fastapi import APIRouter, Depends, Request, status

from app.core.dependencies import get_current_user
from app.models.profile import Profile

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _profile_payload(profile: Profile) -> dict:
    return {
        "id": str(profile.id),
        "display_name": profile.display_name,
        "role": profile.role,
        "org_id": str(profile.org_id) if profile.org_id else None,
    }


@router.get("/me")
async def me(request: Request, current_user: Profile = Depends(get_current_user)):
    """Return current authenticated user profile."""
    return {"user": _profile_payload(current_user)}
