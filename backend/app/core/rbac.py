# backend/app/core/rbac.py
"""FastAPI RBAC dependencies — role-based access control."""

from fastapi import Depends, HTTPException, status
from app.core.dependencies import get_current_user

# Role hierarchy: higher index = more privilege
_ROLE_RANK = {"devco_user": 0, "devco_admin": 1, "pif_admin": 2}


def _check_role(current_user: dict, min_role: str) -> None:
    user_role = current_user.get("system_role")
    if user_role is None or _ROLE_RANK.get(user_role, -1) < _ROLE_RANK[min_role]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires {min_role} or higher",
        )


async def require_pif_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Only pif_admin can access this route."""
    _check_role(current_user, "pif_admin")
    return current_user


async def require_devco_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """devco_admin or pif_admin can access this route."""
    _check_role(current_user, "devco_admin")
    return current_user


async def require_org_member(current_user: dict = Depends(get_current_user)) -> dict:
    """Any authenticated org member can access this route."""
    _check_role(current_user, "devco_user")
    return current_user
