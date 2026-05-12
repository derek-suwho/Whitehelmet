# backend/tests/unit/test_rbac.py
from types import SimpleNamespace

import pytest
from fastapi import HTTPException


def _make_user(role: str):
    """Create a mock user with role attribute matching the Profile model interface."""
    return SimpleNamespace(role=role)


def test_require_org_super_admin_passes():
    import asyncio

    from app.core.rbac import require_org_super_admin

    user = _make_user("org_super_admin")
    asyncio.get_event_loop().run_until_complete(require_org_super_admin(current_user=user))


def test_require_org_super_admin_denies_org_admin():
    import asyncio

    from app.core.rbac import require_org_super_admin

    user = _make_user("org_admin")
    with pytest.raises(HTTPException) as exc_info:
        asyncio.get_event_loop().run_until_complete(require_org_super_admin(current_user=user))
    assert exc_info.value.status_code == 403


def test_require_org_admin_passes():
    import asyncio

    from app.core.rbac import require_org_admin

    for role in ("org_super_admin", "org_admin"):
        user = _make_user(role)
        asyncio.get_event_loop().run_until_complete(require_org_admin(current_user=user))


def test_require_org_admin_denies_org_member():
    import asyncio

    from app.core.rbac import require_org_admin

    user = _make_user("org_member")
    with pytest.raises(HTTPException) as exc_info:
        asyncio.get_event_loop().run_until_complete(require_org_admin(current_user=user))
    assert exc_info.value.status_code == 403


def test_require_org_member_passes_any_role():
    import asyncio

    from app.core.rbac import require_org_member

    for role in ("org_super_admin", "org_admin", "org_member"):
        user = _make_user(role)
        asyncio.get_event_loop().run_until_complete(require_org_member(current_user=user))


def test_require_org_member_denies_no_role():
    import asyncio

    from app.core.rbac import require_org_member

    user = SimpleNamespace(role=None)
    with pytest.raises(HTTPException) as exc_info:
        asyncio.get_event_loop().run_until_complete(require_org_member(current_user=user))
    assert exc_info.value.status_code == 403
