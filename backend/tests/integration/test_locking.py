"""Integration tests — assignment lock/unlock endpoints."""
import pytest


@pytest.fixture
def pif_admin_client(client, db, test_user):
    """Set test_user role to pif_admin and authenticate."""
    from app.models.session import SessionModel
    from app.core.security import generate_session_token, session_expiry, generate_csrf_token
    test_user.role = "pif_admin"
    db.commit()
    token = generate_session_token()
    session = SessionModel(token=token, user_id=test_user.id, expires_at=session_expiry())
    db.add(session)
    db.commit()
    client.cookies.set("session_id", token)
    csrf = generate_csrf_token(token)
    client.headers["X-CSRF-Token"] = csrf
    return client


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
