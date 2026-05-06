# backend/tests/unit/test_rbac.py
import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException


def _make_user(role: str):
    """Create a mock user dict as returned by get_current_user in keycloak mode."""
    return {"external_id": "u-123", "email": "a@b.com", "system_role": role, "org_external_id": "org-001"}


def test_require_org_super_admin_passes():
    from app.core.rbac import require_org_super_admin
    import asyncio
    user = _make_user("org_super_admin")
    asyncio.get_event_loop().run_until_complete(require_org_super_admin(current_user=user))


def test_require_org_super_admin_denies_org_admin():
    from app.core.rbac import require_org_super_admin
    import asyncio
    user = _make_user("org_admin")
    with pytest.raises(HTTPException) as exc_info:
        asyncio.get_event_loop().run_until_complete(require_org_super_admin(current_user=user))
    assert exc_info.value.status_code == 403


def test_require_org_admin_passes():
    from app.core.rbac import require_org_admin
    import asyncio
    for role in ("org_super_admin", "org_admin"):
        user = _make_user(role)
        asyncio.get_event_loop().run_until_complete(require_org_admin(current_user=user))


def test_require_org_admin_denies_org_member():
    from app.core.rbac import require_org_admin
    import asyncio
    user = _make_user("org_member")
    with pytest.raises(HTTPException) as exc_info:
        asyncio.get_event_loop().run_until_complete(require_org_admin(current_user=user))
    assert exc_info.value.status_code == 403


def test_require_org_member_passes_any_role():
    from app.core.rbac import require_org_member
    import asyncio
    for role in ("org_super_admin", "org_admin", "org_member"):
        user = _make_user(role)
        asyncio.get_event_loop().run_until_complete(require_org_member(current_user=user))


def test_require_org_member_denies_no_role():
    from app.core.rbac import require_org_member
    import asyncio
    user = {"external_id": "u-123", "email": "a@b.com", "system_role": None, "org_external_id": "org-001"}
    with pytest.raises(HTTPException) as exc_info:
        asyncio.get_event_loop().run_until_complete(require_org_member(current_user=user))
    assert exc_info.value.status_code == 403
