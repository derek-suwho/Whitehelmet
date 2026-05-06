"""Integration tests — project routes."""

import uuid
import pytest

from app.core.dependencies import get_current_user
from app.models.profile import Profile
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.template import Template
from app.models.template_assignment import TemplateAssignment

# ---------------------------------------------------------------------------
# Fixed IDs
# ---------------------------------------------------------------------------
PROJECT_ID = "00000000-0000-0000-0000-000000000001"
PROJECT_ID_2 = "00000000-0000-0000-0000-000000000002"
MEMBER_USER_ID = "00000000-0000-0000-0000-000000000010"
TEMPLATE_ID = "00000000-0000-0000-0000-000000000020"
ADMIN_USER_ID = "00000000-0000-0000-0000-000000000099"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_pif_admin(user_id: str = ADMIN_USER_ID) -> Profile:
    return Profile(id=user_id, role="org_super_admin", display_name="PIF Admin")


def _override_pif_admin(client, user_id: str = ADMIN_USER_ID):
    """Override get_current_user to return a pif_admin Profile."""
    admin = _make_pif_admin(user_id)

    async def _override():
        return admin

    client.app.dependency_overrides[get_current_user] = _override
    return admin


def _seed_project(db, project_id: str = PROJECT_ID, name: str = "Test Project") -> Project:
    p = Project(id=project_id, name=name, created_by=ADMIN_USER_ID)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def _seed_member_profile(db, user_id: str = MEMBER_USER_ID) -> Profile:
    u = Profile(id=user_id, role="org_member", display_name="Member User")
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _seed_master_template(db, template_id: str = TEMPLATE_ID) -> Template:
    t = Template(id=template_id, name="Master KPI", template_type="master")
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


# ---------------------------------------------------------------------------
# Tests: list_projects
# ---------------------------------------------------------------------------

def test_list_projects_empty(auth_client):
    resp = auth_client.get("/api/projects")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_projects_returns_projects(auth_client, db):
    _seed_project(db, PROJECT_ID, "Alpha")
    _seed_project(db, PROJECT_ID_2, "Beta")
    resp = auth_client.get("/api/projects")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    names = {p["name"] for p in data}
    assert names == {"Alpha", "Beta"}


# ---------------------------------------------------------------------------
# Tests: create_project
# ---------------------------------------------------------------------------

def test_create_project(client, db):
    _override_pif_admin(client)
    resp = client.post("/api/projects", json={"name": "New Project", "description": "A desc"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "New Project"
    assert data["description"] == "A desc"
    assert data["status"] == "active"
    assert "id" in data


def test_create_project_no_description(client, db):
    _override_pif_admin(client)
    resp = client.post("/api/projects", json={"name": "Minimal"})
    assert resp.status_code == 201
    assert resp.json()["description"] is None


def test_create_project_requires_pif_admin(auth_client):
    # auth_client has role=devco_user — must be rejected
    resp = auth_client.post("/api/projects", json={"name": "Denied"})
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Tests: get_project
# ---------------------------------------------------------------------------

def test_get_project(auth_client, db):
    _seed_project(db)
    resp = auth_client.get(f"/api/projects/{PROJECT_ID}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == PROJECT_ID
    assert data["name"] == "Test Project"
    assert data["members"] == []
    assert data["template_assignments"] == []


def test_get_project_not_found(auth_client):
    resp = auth_client.get("/api/projects/nonexistent-id")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Tests: add_member
# ---------------------------------------------------------------------------

def test_add_member(client, db):
    _override_pif_admin(client)
    _seed_project(db)
    _seed_member_profile(db)

    resp = client.post(f"/api/projects/{PROJECT_ID}/members", json={"user_id": MEMBER_USER_ID})
    assert resp.status_code == 201
    assert resp.json()["ok"] is True

    membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == PROJECT_ID,
        ProjectMember.user_id == MEMBER_USER_ID,
    ).first()
    assert membership is not None


def test_add_member_duplicate(client, db):
    _override_pif_admin(client)
    _seed_project(db)
    _seed_member_profile(db)

    client.post(f"/api/projects/{PROJECT_ID}/members", json={"user_id": MEMBER_USER_ID})
    resp = client.post(f"/api/projects/{PROJECT_ID}/members", json={"user_id": MEMBER_USER_ID})
    assert resp.status_code == 409


def test_add_member_project_not_found(client, db):
    _override_pif_admin(client)
    numeric_uid = "3"
    u = Profile(id=numeric_uid, role="org_member", display_name="Orphan")
    db.add(u)
    db.commit()

    resp = client.post("/api/projects/no-such-project/members", json={"user_id": "3"})
    assert resp.status_code == 404


def test_add_member_user_not_found(client, db):
    _override_pif_admin(client)
    _seed_project(db)
    resp = client.post(f"/api/projects/{PROJECT_ID}/members", json={"user_id": "9999"})
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Tests: remove_member
# ---------------------------------------------------------------------------

def _seed_membership(db, project_id: str = PROJECT_ID, user_id: str = MEMBER_USER_ID) -> ProjectMember:
    m = ProjectMember(
        id=str(uuid.uuid4()),
        project_id=project_id,
        user_id=user_id,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


def test_remove_member(client, db):
    _override_pif_admin(client)
    _seed_project(db)
    _seed_member_profile(db)
    membership = _seed_membership(db)

    resp = client.delete(f"/api/projects/{PROJECT_ID}/members/{membership.id}")
    assert resp.status_code == 204

    gone = db.query(ProjectMember).filter(ProjectMember.id == membership.id).first()
    assert gone is None


def test_remove_member_not_found(client, db):
    _override_pif_admin(client)
    _seed_project(db)
    resp = client.delete(f"/api/projects/{PROJECT_ID}/members/nonexistent-membership-id")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Tests: set_master_template
# ---------------------------------------------------------------------------

def test_set_master_template(client, db):
    _override_pif_admin(client)
    _seed_project(db)
    _seed_master_template(db)

    resp = client.patch(
        f"/api/projects/{PROJECT_ID}/master-template",
        json={"master_template_id": TEMPLATE_ID},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["master_template_id"] == TEMPLATE_ID
    assert data["master_template_name"] == "Master KPI"


def test_set_master_template_clear(client, db):
    _override_pif_admin(client)
    _seed_master_template(db)
    p = _seed_project(db)
    p.master_template_id = TEMPLATE_ID
    db.commit()

    resp = client.patch(
        f"/api/projects/{PROJECT_ID}/master-template",
        json={"master_template_id": None},
    )
    assert resp.status_code == 200
    assert resp.json()["master_template_id"] is None


def test_set_master_template_project_not_found(client, db):
    _override_pif_admin(client)
    _seed_master_template(db)

    resp = client.patch(
        "/api/projects/no-such-project/master-template",
        json={"master_template_id": TEMPLATE_ID},
    )
    assert resp.status_code == 404


def test_set_master_template_wrong_type(client, db):
    _override_pif_admin(client)
    _seed_project(db)

    # Template with type "subcontractor" — must be rejected
    sub_tmpl = Template(id="sub-tmpl-id", name="Sub Template", template_type="subcontractor")
    db.add(sub_tmpl)
    db.commit()

    resp = client.patch(
        f"/api/projects/{PROJECT_ID}/master-template",
        json={"master_template_id": "sub-tmpl-id"},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Tests: assign_template
# ---------------------------------------------------------------------------

def test_assign_template_project_wide(client, db):
    _override_pif_admin(client)
    _seed_project(db)

    resp = client.post(
        f"/api/projects/{PROJECT_ID}/assign-template",
        json={"template_version_id": "ver-001"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["ok"] is True
    assert "assignment_id" in data

    assignment = db.query(TemplateAssignment).filter(
        TemplateAssignment.org_id == PROJECT_ID,
        TemplateAssignment.assigned_to_user_id.is_(None),
    ).first()
    assert assignment is not None
    assert assignment.template_version_id == "ver-001"
    assert assignment.status == "pending"


def test_assign_template_per_member(client, db):
    _override_pif_admin(client)
    _seed_project(db)

    resp = client.post(
        f"/api/projects/{PROJECT_ID}/assign-template",
        json={
            "template_version_id": "ver-002",
            "member_user_ids": ["101", "102"],
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["ok"] is True
    assert len(data["assignment_ids"]) == 2

    assignments = db.query(TemplateAssignment).filter(
        TemplateAssignment.org_id == PROJECT_ID,
    ).all()
    assert len(assignments) == 2
    user_ids = {a.assigned_to_user_id for a in assignments}
    assert "101" in user_ids
    assert "102" in user_ids


def test_assign_template_project_not_found(client, db):
    _override_pif_admin(client)
    resp = client.post(
        "/api/projects/no-such-project/assign-template",
        json={"template_version_id": "ver-003"},
    )
    assert resp.status_code == 404


def test_assign_template_with_deadline(client, db):
    _override_pif_admin(client)
    _seed_project(db)

    resp = client.post(
        f"/api/projects/{PROJECT_ID}/assign-template",
        json={"template_version_id": "ver-004", "deadline": "2026-12-31T00:00:00"},
    )
    assert resp.status_code == 201

    assignment = db.query(TemplateAssignment).filter(
        TemplateAssignment.org_id == PROJECT_ID,
    ).first()
    assert assignment is not None
    assert assignment.deadline is not None


def test_get_project_with_members_and_assignments(auth_client, db):
    """Covers get_project member loop, submitter tracking, and template_assignments paths."""
    from app.models.project_member import ProjectMember
    from app.models.template_assignment import TemplateAssignment
    import uuid as _uuid

    _seed_project(db)
    member = _seed_member_profile(db)
    m = ProjectMember(id=str(_uuid.uuid4()), project_id=PROJECT_ID, user_id=MEMBER_USER_ID)
    db.add(m)
    a = TemplateAssignment(
        id=str(_uuid.uuid4()), org_id=PROJECT_ID,
        template_version_id=None, status="pending", submission_type="template",
    )
    db.add(a)
    db.commit()

    resp = auth_client.get(f"/api/projects/{PROJECT_ID}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["members"]) == 1
    assert data["members"][0]["display_name"] == "Member User"
    assert len(data["template_assignments"]) == 1


def test_get_project_with_template_version_assignment(auth_client, db):
    """Covers lines 109-121: template_version_id lookup in get_project."""
    from app.models.template_assignment import TemplateAssignment
    from app.models.template_version import TemplateVersion
    import uuid as _uuid

    VER_ID = "00000000-0000-0000-0000-000000000030"
    TMPL_UUID = "00000000-0000-0000-0000-000000000031"

    _seed_project(db)
    t = Template(id=TMPL_UUID, name="Q1 KPI", template_type="subcontractor")
    db.add(t)
    ver = TemplateVersion(id=VER_ID, template_id=TMPL_UUID, version_number=1,
                          schema_json='{"columns":[]}')
    db.add(ver)
    a = TemplateAssignment(
        id=str(_uuid.uuid4()), org_id=PROJECT_ID,
        template_version_id=VER_ID, status="pending", submission_type="template",
    )
    db.add(a)
    db.commit()

    resp = auth_client.get(f"/api/projects/{PROJECT_ID}")
    assert resp.status_code == 200
    ta = resp.json()["template_assignments"][0]
    assert ta["template_name"] == "Q1 KPI"
    assert ta["template_version_id"] == VER_ID
