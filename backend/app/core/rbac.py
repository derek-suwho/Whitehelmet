# backend/app/core/rbac.py
"""FastAPI RBAC dependencies — role-based access control."""

from fastapi import Depends, HTTPException, status

from app.core.dependencies import get_current_user

_ADMIN_ROLES = frozenset({"super_admin", "coe_admin"})
_ALL_ROLES   = frozenset({"super_admin", "coe_admin", "participant"})


def _is_admin(user) -> bool:
    return getattr(user, "role", None) in _ADMIN_ROLES


async def require_admin(current_user=Depends(get_current_user)):
    """super_admin or coe_admin can access this route."""
    if not _is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requires admin role",
        )
    return current_user


async def require_participant(current_user=Depends(get_current_user)):
    """Any authenticated user with a known role.

    Use on participant-portal routes. Replaces require_subcontractor.
    """
    if getattr(current_user, "role", None) not in _ALL_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unknown role",
        )
    return current_user


# Legacy aliases — kept so any remaining import sites work without change.
# Safe to delete after rollout is confirmed stable.
require_org_super_admin = require_admin
require_org_admin       = require_admin
require_org_member      = require_participant
require_subcontractor   = require_participant
