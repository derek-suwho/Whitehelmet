"""Integration tests — subcontractor portal routes."""

from __future__ import annotations

import io
import uuid
from unittest.mock import patch

import openpyxl
import pytest

from app.core.config import Settings
from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.main import app
from app.models.profile import Profile
from app.models.template_assignment import TemplateAssignment
from app.models.submission import Submission


# ── Helpers ──────────────────────────────────────────────────────────────────

def make_xlsx() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Col A", "Col B"])
    ws.append([1, 2])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


ORG_ID = "00000000-0000-0000-0000-000000000001"
OTHER_ORG_ID = "00000000-0000-0000-0000-000000000002"


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def devco_user(db) -> Profile:
    user = Profile(
        id=str(uuid.uuid4()),
        role="devco_user",
        display_name="DevCo User",
        org_id=ORG_ID,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def devco_client(db, devco_user, tmp_path):
    """TestClient with get_current_user overridden to devco_user and tmp upload_dir."""
    test_settings = Settings(
        anthropic_api_key="",
        openrouter_api_key="",
        upload_dir=str(tmp_path / "uploads"),
        max_upload_size_mb=50,
        session_secret="test-secret",
        csrf_secret="test-csrf-secret",
        db_password="",
    )

    def override_db():
        try:
            yield db
        finally:
            pass

    async def override_user():
        return devco_user

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user

    from fastapi.testclient import TestClient
    # Patch get_settings at the route module level so direct calls also get the tmp dir
    with patch("app.api.routes.subcontractor.get_settings", return_value=test_settings):
        with TestClient(app) as c:
            yield c

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)


def _make_assignment(db, org_id=ORG_ID, assigned_to_user_id=None, status="pending"):
    a = TemplateAssignment(
        id=str(uuid.uuid4()),
        org_id=org_id,
        assigned_to_user_id=assigned_to_user_id,
        submission_type="template",
        status=status,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


# ── 1. list_my_assignments ────────────────────────────────────────────────────

def test_list_assignments_no_org(db):
    """User with no org_id → 400."""
    user = Profile(id=str(uuid.uuid4()), role="devco_user", display_name="No Org")
    db.add(user)
    db.commit()
    db.refresh(user)

    async def override_user():
        return user

    def override_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user

    from fastapi.testclient import TestClient
    with TestClient(app) as c:
        resp = c.get("/api/subcontractor/assignments")

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 400
    assert "org_id" in resp.json()["detail"]


def test_list_assignments_empty(devco_client):
    """User with org_id but no assignments → 200, empty list."""
    resp = devco_client.get("/api/subcontractor/assignments")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_assignments_project_wide(devco_client, db, devco_user):
    """Project-wide assignment (assigned_to_user_id=None, org matches) → appears in list."""
    _make_assignment(db, org_id=ORG_ID, assigned_to_user_id=None)

    resp = devco_client.get("/api/subcontractor/assignments")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["has_submission"] is False


def test_list_assignments_targeted(devco_client, db, devco_user):
    """Assignment targeted directly at user.id → appears in list."""
    _make_assignment(db, org_id=OTHER_ORG_ID, assigned_to_user_id=str(devco_user.id))

    resp = devco_client.get("/api/subcontractor/assignments")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_list_assignments_other_org_excluded(devco_client, db):
    """Assignment for a different org (no user targeting) → NOT returned."""
    _make_assignment(db, org_id=OTHER_ORG_ID, assigned_to_user_id=None)

    resp = devco_client.get("/api/subcontractor/assignments")
    assert resp.status_code == 200
    assert resp.json() == []


# ── 2. submit_file ────────────────────────────────────────────────────────────

def test_submit_file_success(devco_client, db, devco_user):  # settings_override active via devco_client
    """Upload valid xlsx against a pending assignment → 201, creates submission."""
    a = _make_assignment(db, org_id=ORG_ID, status="pending")

    xlsx = make_xlsx()
    resp = devco_client.post(
        f"/api/subcontractor/assignments/{a.id}/submit",
        files={"file": ("report.xlsx", xlsx, "application/octet-stream")},
    )
    assert resp.status_code == 201, resp.json()
    body = resp.json()
    assert body["assignment_id"] == a.id
    assert body["status"] == "submitted"
    assert body["file_name"] == "report.xlsx"


def test_submit_file_locked(devco_client, db):
    """Upload to a locked assignment → 409."""
    a = _make_assignment(db, org_id=ORG_ID, status="locked")

    xlsx = make_xlsx()
    resp = devco_client.post(
        f"/api/subcontractor/assignments/{a.id}/submit",
        files={"file": ("report.xlsx", xlsx, "application/octet-stream")},
    )
    assert resp.status_code == 409


def test_submit_file_bad_extension(devco_client, db):
    """Upload a .txt file → 400."""
    a = _make_assignment(db, org_id=ORG_ID, status="pending")

    resp = devco_client.post(
        f"/api/subcontractor/assignments/{a.id}/submit",
        files={"file": ("data.txt", b"hello world", "text/plain")},
    )
    assert resp.status_code == 400
    assert "xlsx" in resp.json()["detail"].lower()


def test_submit_file_not_found(devco_client):
    """Unknown assignment_id → 404."""
    xlsx = make_xlsx()
    fake_id = str(uuid.uuid4())
    resp = devco_client.post(
        f"/api/subcontractor/assignments/{fake_id}/submit",
        files={"file": ("report.xlsx", xlsx, "application/octet-stream")},
    )
    assert resp.status_code == 404


# ── 3. list_my_submissions ────────────────────────────────────────────────────

def test_list_submissions(devco_client, db, devco_user):
    """After a successful upload, submissions list returns the entry."""
    a = _make_assignment(db, org_id=ORG_ID, status="pending")

    xlsx = make_xlsx()
    post_resp = devco_client.post(
        f"/api/subcontractor/assignments/{a.id}/submit",
        files={"file": ("report.xlsx", xlsx, "application/octet-stream")},
    )
    assert post_resp.status_code == 201

    resp = devco_client.get("/api/subcontractor/submissions")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["assignment_id"] == a.id
    assert data[0]["file_name"] == "report.xlsx"


def test_download_template(devco_client, db):
    """download_template generates an xlsx from the template schema."""
    import json
    from app.models.template import Template
    from app.models.template_version import TemplateVersion
    from app.models.template_assignment import TemplateAssignment

    VER_ID = "00000000-0000-0000-0000-000000000010"

    t = Template(id="00000000-0000-0000-0000-000000000020", name="Download Template", template_type="subcontractor")
    db.add(t)
    ver = TemplateVersion(
        id=VER_ID, template_id="00000000-0000-0000-0000-000000000020", version_number=1,
        schema_json=json.dumps({"columns": [{"name": "KPI"}, {"name": "Value"}]})
    )
    db.add(ver)
    a = TemplateAssignment(
        id="asn-dl-1", template_version_id=VER_ID,
        org_id=ORG_ID, status="pending", submission_type="template",
    )
    db.add(a)
    db.commit()

    resp = devco_client.get("/api/subcontractor/assignments/asn-dl-1/template-download")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/vnd.openxmlformats")


def test_download_template_not_found(devco_client):
    resp = devco_client.get("/api/subcontractor/assignments/nonexistent/template-download")
    assert resp.status_code == 404


def test_download_template_no_org(client, db):
    """User without org_id gets 400."""
    from app.core.dependencies import get_current_user
    from app.models.profile import Profile
    import uuid
    user = Profile(id=str(uuid.uuid4()), role="devco_user", display_name="NoOrg")
    db.add(user); db.commit()
    async def override(): return user
    client.app.dependency_overrides[get_current_user] = override
    resp = client.get("/api/subcontractor/assignments/any/template-download")
    assert resp.status_code == 400
    client.app.dependency_overrides.pop(get_current_user, None)
