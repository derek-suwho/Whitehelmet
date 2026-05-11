# backend/app/core/rbac.py
"""FastAPI RBAC dependencies — role-based access control."""

from fastapi import Depends, HTTPException, status

from app.core.dependencies import get_current_user

_ADMIN_ROLES = frozenset({"super_admin", "coe_admin", "org_super_admin", "org_admin"})
_ALL_ROLES   = frozenset({"super_admin", "coe_admin", "org_super_admin", "org_admin", "org_member", "participant"})


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


_SUPER_ADMIN_ROLES = frozenset({"super_admin", "coe_admin", "org_super_admin"})


async def require_org_super_admin(current_user=Depends(get_current_user)):
    """Only super-admin-tier roles (not org_admin)."""
    if getattr(current_user, "role", None) not in _SUPER_ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Requires super admin role")
    return current_user


# Legacy aliases
require_org_admin     = require_admin
require_org_member    = require_participant
require_subcontractor = require_participant
