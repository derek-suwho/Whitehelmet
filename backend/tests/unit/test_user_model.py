"""Test User shim — User is now Profile."""

import uuid


def test_user_shim_is_profile(db):
    """User import should resolve to Profile."""
    from app.models.profile import Profile
    from app.models.user import User

    assert User is Profile


def test_profile_has_role_and_org_id(db):
    """Profile should have role and org_id columns."""
    from app.models.profile import Profile

    profile = Profile(
        id=str(uuid.uuid4()),
        role="org_super_admin",
        org_id=str(uuid.uuid4()),
        display_name="Test",
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    assert profile.role == "org_super_admin"
    assert profile.org_id is not None
