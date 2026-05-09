"""Integration tests — assignment lock/unlock endpoints."""
import pytest


@pytest.fixture
def pif_admin_client(client, db, test_user):
    """Set test_user role to pif_admin and authenticate via dependency override."""
    from app.core.dependencies import get_current_user
    test_user.role = "org_super_admin"
    db.commit()

    async def override():
        return test_user

    client.app.dependency_overrides[get_current_user] = override
    yield client
    client.app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def assignment(db):
    from app.models.template_assignment import TemplateAssignment
    a = TemplateAssignment(id="asn-lock-1", org_id="org-1", submission_type="template", status="submitted")
    db.add(a)
    db.commit()
    return a


def test_lock_assignment(pif_admin_client, assignment):
    resp = pif_admin_client.post(f"/api/admin/assignments/{assignment.id}/lock")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "locked"
    assert data["locked_at"] is not None
    assert data["locked_by"] is not None


def test_lock_already_locked(pif_admin_client, assignment, db):
    assignment.status = "locked"
    db.commit()
    resp = pif_admin_client.post(f"/api/admin/assignments/{assignment.id}/lock")
    assert resp.status_code == 409


def test_unlock_assignment(pif_admin_client, assignment, db):
    assignment.status = "locked"
    db.commit()
    resp = pif_admin_client.post(f"/api/admin/assignments/{assignment.id}/unlock")
    assert resp.status_code == 200
    assert resp.json()["status"] == "submitted"


def test_lock_requires_pif_admin(client, assignment):
    resp = client.post(f"/api/admin/assignments/{assignment.id}/lock")
    assert resp.status_code in (401, 403)
