"""Test User model — role + org_id columns."""

import pytest


def test_user_has_role_and_org_id(db):
    """User should have role and org_id columns."""
    from app.models.user import User

    user = User(
        external_id="ext-1",
        email="a@b.com",
        display_name="Test",
        role="org_super_admin",
        org_id="org-uuid-1",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    assert user.role == "org_super_admin"
    assert user.org_id == "org-uuid-1"
