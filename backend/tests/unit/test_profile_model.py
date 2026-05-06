import uuid
from app.models.profile import Profile


def test_profile_has_uuid_pk():
    p = Profile(id=str(uuid.uuid4()), org_id=None, role="devco_user", display_name="Alice")
    assert p.display_name == "Alice"
    assert p.role == "devco_user"


def test_profile_tablename():
    assert Profile.__tablename__ == "profiles"
