"""Project routes — CRUD, template assignment, member management."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, verify_csrf
from app.core.rbac import require_org_super_admin
from app.db.session import get_db
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.submission import Submission
from app.models.template import Template
from app.models.template_assignment import TemplateAssignment
from app.models.template_version import TemplateVersion
from app.models.user import User
from app.schemas.projects import (
    AddMemberRequest,
    AssignMasterTemplateRequest,
    AssignTemplateRequest,
    ProjectCreate,
    ProjectDetailResponse,
    ProjectResponse,
)

router = APIRouter(
    prefix="/api/projects",
    tags=["projects"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=list[ProjectResponse])
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).order_by(Project.created_at.desc()).all()


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_org_super_admin), Depends(verify_csrf)],
)
def create_project(
    body: ProjectCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = Project(
        id=str(uuid.uuid4()),
        name=body.name,
        description=body.description,
        created_by=str(user.id),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.get("/{project_id}", response_model=ProjectDetailResponse)
def get_project(project_id: str, db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    members_q = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()

    assignments_q = (
        db.query(TemplateAssignment)
        .filter(TemplateAssignment.org_id == project_id)
        .order_by(TemplateAssignment.assigned_at.desc())
        .all()
    )
    assignment_ids = [a.id for a in assignments_q]

    # Which users have submitted against any assignment in this project
    submitter_ids: set[str] = set()
    if assignment_ids:
        rows = (
            db.query(Submission.submitted_by)
            .filter(Submission.assignment_id.in_(assignment_ids))
            .all()
        )
        submitter_ids = {r[0] for r in rows if r[0] is not None}

    # Re-build members list now that we have submitter info
    members = []
    for m in members_q:
        u = db.query(User).filter(User.id == m.user_id).first()
        if u:
            members.append(
                {
                    "membership_id": m.id,
                    "user_id": u.id,
                    "display_name": u.display_name,
                    "email": u.email,
                    "role": u.role,
                    "added_at": m.added_at.isoformat() if m.added_at else None,
                    "has_submission": str(u.id) in submitter_ids,
                }
            )

    template_assignments = []
    for a in assignments_q:
        template_name = None
        template_id = None
        if a.template_version_id:
            ver = (
                db.query(TemplateVersion)
                .filter(TemplateVersion.id == a.template_version_id)
                .first()
            )
            if ver:
                template_id = ver.template_id
                tmpl = db.query(Template).filter(Template.id == ver.template_id).first()
                template_name = tmpl.name if tmpl else None
        assigned_to_display = None
        if a.assigned_to_user_id:
            target = db.query(User).filter(User.id == a.assigned_to_user_id).first()
            assigned_to_display = target.display_name if target else None

        template_assignments.append(
            {
                "assignment_id": a.id,
                "template_version_id": a.template_version_id,
                "template_id": template_id,
                "template_name": template_name,
                "status": a.status,
                "deadline": a.deadline.isoformat() if a.deadline else None,
                "assigned_at": a.assigned_at.isoformat() if a.assigned_at else None,
                "assigned_to_user_id": a.assigned_to_user_id,
                "assigned_to_display": assigned_to_display,
            }
        )

    master_template_name = None
    if p.master_template_id:
        mt = db.query(Template).filter(Template.id == p.master_template_id).first()
        master_template_name = mt.name if mt else None

    return ProjectDetailResponse(
        id=p.id,
        name=p.name,
        description=p.description,
        status=p.status,
        master_template_id=p.master_template_id,
        master_template_name=master_template_name,
        created_at=p.created_at,
        members=members,
        template_assignments=template_assignments,
    )


@router.post(
    "/{project_id}/members",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_org_super_admin), Depends(verify_csrf)],
)
def add_member(
    project_id: str,
    body: AddMemberRequest,
    db: Session = Depends(get_db),
):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    user = db.query(User).filter(User.id == body.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == body.user_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="User already in this project")

    member = ProjectMember(
        id=str(uuid.uuid4()),
        project_id=project_id,
        user_id=body.user_id,
    )
    db.add(member)
    user.org_id = project_id
    db.commit()
    return {"ok": True}


@router.delete(
    "/{project_id}/members/{membership_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_org_super_admin), Depends(verify_csrf)],
)
def remove_member(
    project_id: str,
    membership_id: str,
    db: Session = Depends(get_db),
):
    m = (
        db.query(ProjectMember)
        .filter(
            ProjectMember.id == membership_id,
            ProjectMember.project_id == project_id,
        )
        .first()
    )
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(m)
    db.commit()


@router.patch(
    "/{project_id}/master-template",
    response_model=ProjectDetailResponse,
    dependencies=[Depends(require_org_super_admin), Depends(verify_csrf)],
)
def set_master_template(
    project_id: str,
    body: AssignMasterTemplateRequest,
    db: Session = Depends(get_db),
):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    if body.master_template_id:
        tmpl = db.query(Template).filter(
            Template.id == body.master_template_id,
            Template.template_type == "master",
        ).first()
        if not tmpl:
            raise HTTPException(status_code=404, detail="Master template not found")
        p.master_template_id = body.master_template_id
    else:
        p.master_template_id = None

    db.commit()
    db.refresh(p)
    return get_project(project_id, db)


@router.post(
    "/{project_id}/assign-template",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_org_super_admin), Depends(verify_csrf)],
)
def assign_template(
    project_id: str,
    body: AssignTemplateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    deadline_dt = datetime.fromisoformat(body.deadline) if body.deadline else None

    if body.member_user_ids:
        # Per-member assignments — one record per selected user
        created = []
        for uid in body.member_user_ids:
            a = TemplateAssignment(
                id=str(uuid.uuid4()),
                template_version_id=body.template_version_id,
                org_id=project_id,
                assigned_by=str(user.id),
                deadline=deadline_dt,
                submission_type="template",
                status="pending",
                assigned_to_user_id=str(uid),
            )
            db.add(a)
            created.append(a.id)
        db.commit()
        return {"ok": True, "assignment_ids": created}
    else:
        # Project-wide assignment (all members see it)
        a = TemplateAssignment(
            id=str(uuid.uuid4()),
            template_version_id=body.template_version_id,
            org_id=project_id,
            assigned_by=str(user.id),
            deadline=deadline_dt,
            submission_type="template",
            status="pending",
            assigned_to_user_id=None,
        )
        db.add(a)
        db.commit()
        db.refresh(a)
        return {"ok": True, "assignment_id": a.id}


@router.get("/{project_id}/submissions")
def list_project_submissions(project_id: str, db: Session = Depends(get_db)):
    """Return all submissions for a project, enriched with submitter name."""
    assignment_ids = [
        a.id for a in db.query(TemplateAssignment)
        .filter(TemplateAssignment.org_id == project_id)
        .all()
    ]
    if not assignment_ids:
        return []

    submissions = (
        db.query(Submission)
        .filter(Submission.assignment_id.in_(assignment_ids))
        .order_by(Submission.submitted_at.desc())
        .all()
    )

    result = []
    user_cache: dict[str, str] = {}
    for idx, s in enumerate(submissions):
        if s.submitted_by and s.submitted_by not in user_cache:
            u = db.query(User).filter(User.id == s.submitted_by).first()
            user_cache[s.submitted_by] = u.display_name if u else "Unknown"
        result.append({
            "id": s.id,
            "row_number": idx + 1,
            "file_name": s.file_name,
            "submitter_name": user_cache.get(s.submitted_by or "", "Unknown"),
            "reporting_period": s.reporting_period,
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
            "status": s.status,
        })
    return result
