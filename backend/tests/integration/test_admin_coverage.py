"""Integration tests — admin route coverage for consolidation-progress, submission-overview, lock/unlock."""
import uuid
import pytest

from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.template import Template
from app.models.template_version import TemplateVersion
from app.models.template_assignment import TemplateAssignment
from app.models.submission import Submission
from app.models.profile import Profile


# ── pif_admin fixture ─────────────────────────────────────────────────────────

@pytest.fixture
def pif_client(client, db, test_user):
    """TestClient whose get_current_user returns a pif_admin profile."""
    from app.core.dependencies import get_current_user

    test_user.role = "org_super_admin"
    db.commit()

    async def override():
        return test_user

    client.app.dependency_overrides[get_current_user] = override
    yield client
    client.app.dependency_overrides.pop(get_current_user, None)


# ── helpers ───────────────────────────────────────────────────────────────────

def _uid():
    return str(uuid.uuid4())


def _make_project(db, name="Test Project"):
    p = Project(id=_uid(), name=name, status="active")
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def _make_profile(db, display_name="Member", role="org_member"):
    u = Profile(id=_uid(), role=role, display_name=display_name)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _make_template(db, name="T", template_type="subcontractor"):
    t = Template(
        id=_uid(),
        name=name,
        template_type=template_type,
        status="draft",
        created_by=_uid(),
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def _make_version(db, template_id):
    v = TemplateVersion(
        id=_uid(),
        template_id=template_id,
        version_number=1,
        schema_json="{}",
        created_by=_uid(),
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


def _make_assignment(db, org_id, version_id=None, status="pending", submission_type="template"):
    a = TemplateAssignment(
        id=_uid(),
        org_id=org_id,
        template_version_id=version_id,
        status=status,
        submission_type=submission_type,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


def _make_submission(db, assignment_id, org_id, submitted_by):
    s = Submission(
        id=_uid(),
        assignment_id=assignment_id,
        org_id=org_id,
        file_path="/tmp/fake.xlsx",
        file_name="fake.xlsx",
        submitted_by=submitted_by,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


# ── consolidation-progress: project_id mode ───────────────────────────────────

def test_consolidation_progress_project_mode(pif_client, db, test_user):
    """project_id mode lists members and marks submitted ones correctly."""
    project = _make_project(db)
    user2 = _make_profile(db, display_name="Member 2")

    # Add both users as project members
    for uid in [test_user.id, user2.id]:
        db.add(ProjectMember(id=_uid(), project_id=project.id, user_id=str(uid)))
    db.commit()

    # One assignment for the project (org_id = project.id)
    tmpl = _make_template(db)
    ver = _make_version(db, tmpl.id)
    assignment = _make_assignment(db, org_id=project.id, version_id=ver.id)

    # Only test_user has a submission
    _make_submission(db, assignment.id, project.id, str(test_user.id))

    resp = pif_client.get(
        f"/api/admin/templates/{tmpl.id}/consolidation-progress",
        params={"project_id": project.id},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_orgs"] == 2
    assert data["submitted_count"] == 1
    assert data["all_submitted"] is False
    # One org should be "submitted", one "pending"
    statuses = {row["org_id"]: row["assignment_status"] for row in data["orgs"]}
    assert statuses[str(test_user.id)] == "submitted"
    assert statuses[str(user2.id)] == "pending"


def test_consolidation_progress_project_not_found(pif_client, db):
    """project_id mode with unknown project_id returns 404."""
    tmpl = _make_template(db)
    resp = pif_client.get(
        f"/api/admin/templates/{tmpl.id}/consolidation-progress",
        params={"project_id": "does-not-exist"},
    )
    assert resp.status_code == 404


# ── consolidation-progress: assignment mode ───────────────────────────────────

def test_consolidation_progress_assignment_mode(pif_client, db, test_user):
    """Assignment mode uses TemplateVersion → TemplateAssignments → Submissions."""
    tmpl = _make_template(db)
    ver = _make_version(db, tmpl.id)
    assignment = _make_assignment(db, org_id=_uid(), version_id=ver.id, submission_type="template")

    # Add a submission for the assignment
    _make_submission(db, assignment.id, assignment.org_id, str(test_user.id))

    resp = pif_client.get(f"/api/admin/templates/{tmpl.id}/consolidation-progress")
    assert resp.status_code == 200
    data = resp.json()
    assert data["template_id"] == tmpl.id
    assert data["template_version_id"] == ver.id
    assert data["submitted_count"] == 1
    assert len(data["orgs"]) >= 1


def test_consolidation_progress_assignment_mode_no_version(pif_client, db):
    """Assignment mode with no TemplateVersion returns empty result."""
    tmpl = _make_template(db)
    resp = pif_client.get(f"/api/admin/templates/{tmpl.id}/consolidation-progress")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_orgs"] == 0
    assert data["submitted_count"] == 0
    assert data["template_version_id"] is None


# ── submission-overview ───────────────────────────────────────────────────────

def test_project_submission_overview(pif_client, db, test_user):
    """Returns correct totals for a project with members and template assignments."""
    project = _make_project(db)
    user2 = _make_profile(db, display_name="Member 2")

    for uid in [test_user.id, user2.id]:
        db.add(ProjectMember(id=_uid(), project_id=project.id, user_id=str(uid)))
    db.commit()

    tmpl = _make_template(db)
    ver = _make_version(db, tmpl.id)
    assignment = _make_assignment(db, org_id=project.id, version_id=ver.id)

    # Only test_user submits
    _make_submission(db, assignment.id, project.id, str(test_user.id))

    resp = pif_client.get(f"/api/admin/projects/{project.id}/submission-overview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_members"] == 2
    assert len(data["templates"]) == 1
    tpl_summary = data["templates"][0]
    assert tpl_summary["template_id"] == tmpl.id
    assert tpl_summary["submitted_count"] == 1
    assert tpl_summary["total_members"] == 2
    assert tpl_summary["all_submitted"] is False


def test_project_submission_overview_not_found(pif_client, db):
    """Returns 404 for unknown project_id."""
    resp = pif_client.get("/api/admin/projects/does-not-exist/submission-overview")
    assert resp.status_code == 404


# ── lock / unlock ─────────────────────────────────────────────────────────────

def test_lock_already_locked(pif_client, db):
    """Locking an already-locked assignment returns 409."""
    assignment = _make_assignment(db, org_id=_uid(), status="locked")

    resp = pif_client.post(f"/api/admin/assignments/{assignment.id}/lock")
    assert resp.status_code == 409
    assert "already locked" in resp.json()["detail"].lower()


def test_unlock_assignment(pif_client, db):
    """Unlocking a locked assignment sets status back to 'submitted'."""
    assignment = _make_assignment(db, org_id=_uid(), status="locked")

    resp = pif_client.post(f"/api/admin/assignments/{assignment.id}/unlock")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "submitted"
    assert data["locked_at"] is None
    assert data["locked_by"] is None


# ── update_user_role 404 ──────────────────────────────────────────────────────

def test_update_user_role_not_found(pif_client, db):
    resp = pif_client.patch("/api/admin/users/does-not-exist/role", json={"role": "org_admin"})
    assert resp.status_code == 404


# ── consolidation-progress: project mode orphan member ───────────────────────

def test_consolidation_progress_project_mode_orphan_member(pif_client, db):
    """ProjectMember whose Profile row doesn't exist is silently skipped."""
    project = _make_project(db)
    db.add(ProjectMember(id=_uid(), project_id=project.id, user_id=_uid()))
    db.commit()
    tmpl = _make_template(db)
    resp = pif_client.get(
        f"/api/admin/templates/{tmpl.id}/consolidation-progress",
        params={"project_id": project.id},
    )
    assert resp.status_code == 200
    assert resp.json()["total_orgs"] == 0


# ── consolidation-progress: assignment mode with no submissions ───────────────

def test_consolidation_progress_assignment_no_submissions(pif_client, db):
    """Assignment with no submissions appears as pending in the response."""
    tmpl = _make_template(db)
    ver = _make_version(db, tmpl.id)
    _make_assignment(db, org_id=_uid(), version_id=ver.id, submission_type="template")
    resp = pif_client.get(f"/api/admin/templates/{tmpl.id}/consolidation-progress")
    assert resp.status_code == 200
    data = resp.json()
    assert data["submitted_count"] == 0
    assert len(data["orgs"]) == 1
    assert data["orgs"][0]["assignment_status"] == "pending"


# ── submission-overview edge cases ────────────────────────────────────────────

def test_project_submission_overview_assignment_no_version_id(pif_client, db):
    """Assignments without template_version_id are skipped."""
    project = _make_project(db)
    _make_assignment(db, org_id=project.id, version_id=None)
    resp = pif_client.get(f"/api/admin/projects/{project.id}/submission-overview")
    assert resp.status_code == 200
    assert resp.json()["templates"] == []


def test_project_submission_overview_missing_version(pif_client, db):
    """Assignments referencing a non-existent TemplateVersion are skipped."""
    project = _make_project(db)
    _make_assignment(db, org_id=project.id, version_id=_uid())  # orphan version_id
    resp = pif_client.get(f"/api/admin/projects/{project.id}/submission-overview")
    assert resp.status_code == 200
    assert resp.json()["templates"] == []


def test_project_submission_overview_duplicate_template(pif_client, db):
    """Two assignments for the same template version produce one template entry."""
    project = _make_project(db)
    user1 = _make_profile(db)
    db.add(ProjectMember(id=_uid(), project_id=project.id, user_id=user1.id))
    db.commit()
    tmpl = _make_template(db)
    ver = _make_version(db, tmpl.id)
    _make_assignment(db, org_id=project.id, version_id=ver.id)
    _make_assignment(db, org_id=project.id, version_id=ver.id)
    resp = pif_client.get(f"/api/admin/projects/{project.id}/submission-overview")
    assert resp.status_code == 200
    assert len(resp.json()["templates"]) == 1


# ── lock / unlock error paths ────────────────────────────────────────────────

def test_lock_assignment_success(pif_client, db, test_user):
    """Locking a pending assignment sets status, locked_at, and locked_by."""
    assignment = _make_assignment(db, org_id=_uid(), status="pending")
    resp = pif_client.post(f"/api/admin/assignments/{assignment.id}/lock")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "locked"
    assert data["locked_at"] is not None
    assert data["locked_by"] == str(test_user.id)


def test_lock_assignment_not_found(pif_client, db):
    resp = pif_client.post("/api/admin/assignments/does-not-exist/lock")
    assert resp.status_code == 404


def test_unlock_assignment_not_found(pif_client, db):
    resp = pif_client.post("/api/admin/assignments/does-not-exist/unlock")
    assert resp.status_code == 404


# ── consolidate-submissions early 400 paths ───────────────────────────────────

def test_consolidate_submissions_no_params(pif_client, db):
    """Neither project_id nor submission_ids → 400."""
    tmpl = _make_template(db)
    resp = pif_client.post(
        f"/api/admin/templates/{tmpl.id}/consolidate-submissions", json={}
    )
    assert resp.status_code == 400
    assert "required" in resp.json()["detail"].lower()


def test_consolidate_submissions_no_results_by_project(pif_client, db):
    """project_id with no assignments → no submissions → 400."""
    tmpl = _make_template(db)
    project = _make_project(db)
    resp = pif_client.post(
        f"/api/admin/templates/{tmpl.id}/consolidate-submissions",
        json={"project_id": project.id},
    )
    assert resp.status_code == 400
    assert "No submissions" in resp.json()["detail"]


def test_consolidate_submissions_no_results_by_ids(pif_client, db):
    """submission_ids with non-existent IDs → 400."""
    tmpl = _make_template(db)
    resp = pif_client.post(
        f"/api/admin/templates/{tmpl.id}/consolidate-submissions",
        json={"submission_ids": [_uid()]},
    )
    assert resp.status_code == 400
    assert "No submissions" in resp.json()["detail"]


def test_consolidate_submissions_missing_files(pif_client, db, test_user):
    """All submission files missing on disk → 400 'Could not read any submission files'."""
    tmpl = _make_template(db)
    project = _make_project(db)
    ver = _make_version(db, tmpl.id)
    assignment = _make_assignment(db, org_id=project.id, version_id=ver.id)
    _make_submission(db, assignment.id, project.id, str(test_user.id))
    resp = pif_client.post(
        f"/api/admin/templates/{tmpl.id}/consolidate-submissions",
        json={"project_id": project.id},
    )
    assert resp.status_code == 400
    assert "Could not read" in resp.json()["detail"]
