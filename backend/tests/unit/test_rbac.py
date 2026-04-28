# backend/tests/unit/test_rbac.py
import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException


def _make_user(role: str):
    """Create a mock user dict as returned by get_current_user in keycloak mode."""
    return {"external_id": "u-123", "email": "a@b.com", "system_role": role, "org_external_id": "org-001"}


def test_require_pif_admin_passes():
    from app.core.rbac import require_pif_admin
    import asyncio
    user = _make_user("pif_admin")
    asyncio.get_event_loop().run_until_complete(require_pif_admin(current_user=user))


def test_require_pif_admin_denies_devco_admin():
    from app.core.rbac import require_pif_admin
    import asyncio
    user = _make_user("devco_admin")
    with pytest.raises(HTTPException) as exc_info:
        asyncio.get_event_loop().run_until_complete(require_pif_admin(current_user=user))
    assert exc_info.value.status_code == 403


def test_require_devco_admin_passes_devco_admin():
    from app.core.rbac import require_devco_admin
    import asyncio
    for role in ("pif_admin", "devco_admin"):
        user = _make_user(role)
        asyncio.get_event_loop().run_until_complete(require_devco_admin(current_user=user))


def test_require_devco_admin_denies_devco_user():
    from app.core.rbac import require_devco_admin
    import asyncio
    user = _make_user("devco_user")
    with pytest.raises(HTTPException) as exc_info:
        asyncio.get_event_loop().run_until_complete(require_devco_admin(current_user=user))
    assert exc_info.value.status_code == 403


def test_require_org_member_passes_any_role():
    from app.core.rbac import require_org_member
    import asyncio
    for role in ("pif_admin", "devco_admin", "devco_user"):
        user = _make_user(role)
        asyncio.get_event_loop().run_until_complete(require_org_member(current_user=user))


def test_require_org_member_denies_no_role():
    from app.core.rbac import require_org_member
    import asyncio
    user = {"external_id": "u-123", "email": "a@b.com", "system_role": None, "org_external_id": "org-001"}
    with pytest.raises(HTTPException) as exc_info:
        asyncio.get_event_loop().run_until_complete(require_org_member(current_user=user))
    assert exc_info.value.status_code == 403
