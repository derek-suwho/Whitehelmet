import uuid

from app.models.profile import Profile


def test_profile_has_uuid_pk():
    p = Profile(id=str(uuid.uuid4()), org_id=None, role="org_member", display_name="Alice")
    assert p.display_name == "Alice"
    assert p.role == "org_member"


def test_profile_tablename():
    assert Profile.__tablename__ == "profiles"
