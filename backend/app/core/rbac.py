# backend/app/core/rbac.py
"""FastAPI RBAC dependencies — role-based access control."""

from fastapi import Depends, HTTPException, status
from app.core.dependencies import get_current_user

# Role hierarchy: higher index = more privilege
_ROLE_RANK = {"subcontractor": -1, "org_member": 0, "org_admin": 1, "org_super_admin": 2}


def _check_role(current_user, min_role: str) -> None:
    user_role = getattr(current_user, "role", None)
    if user_role is None or _ROLE_RANK.get(user_role, -1) < _ROLE_RANK[min_role]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires {min_role} or higher",
        )


async def require_org_super_admin(current_user=Depends(get_current_user)):
    """Only org_super_admin can access this route."""
    _check_role(current_user, "org_super_admin")
    return current_user


async def require_org_admin(current_user=Depends(get_current_user)):
    """org_admin or org_super_admin can access this route."""
    _check_role(current_user, "org_admin")
    return current_user


async def require_org_member(current_user=Depends(get_current_user)):
    """Any authenticated org member can access this route."""
    _check_role(current_user, "org_member")
    return current_user


async def require_subcontractor(current_user=Depends(get_current_user)):
    """Any authenticated user whose role is known — including subcontractor.

    Subcontractors are blocked by require_org_member and above, so use this
    dependency on subcontractor-portal-specific routes.
    """
    if getattr(current_user, "role", None) not in _ROLE_RANK:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unknown role",
        )
    return current_user
