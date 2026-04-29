"""Project routes — CRUD, template assignment, member management."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, verify_csrf
from app.core.rbac import require_pif_admin
from app.db.session import get_db
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.template import Template
from app.models.template_assignment import TemplateAssignment
from app.models.template_version import TemplateVersion
from app.models.user import User
from app.schemas.projects import (
    AddMemberRequest,
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
    dependencies=[Depends(require_pif_admin), Depends(verify_csrf)],
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
                }
            )

    assignments_q = (
        db.query(TemplateAssignment)
        .filter(TemplateAssignment.org_id == project_id)
        .order_by(TemplateAssignment.assigned_at.desc())
        .all()
    )
    template_assignments = []
    for a in assignments_q:
        template_name = None
        if a.template_version_id:
            ver = (
                db.query(TemplateVersion)
                .filter(TemplateVersion.id == a.template_version_id)
                .first()
            )
            if ver:
                tmpl = db.query(Template).filter(Template.id == ver.template_id).first()
                template_name = tmpl.name if tmpl else None
        template_assignments.append(
            {
                "assignment_id": a.id,
                "template_version_id": a.template_version_id,
                "template_name": template_name,
                "status": a.status,
                "deadline": a.deadline.isoformat() if a.deadline else None,
                "assigned_at": a.assigned_at.isoformat() if a.assigned_at else None,
            }
        )

    return ProjectDetailResponse(
        id=p.id,
        name=p.name,
        description=p.description,
        status=p.status,
        created_at=p.created_at,
        members=members,
        template_assignments=template_assignments,
    )


@router.post(
    "/{project_id}/members",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_pif_admin), Depends(verify_csrf)],
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
    dependencies=[Depends(require_pif_admin), Depends(verify_csrf)],
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


@router.post(
    "/{project_id}/assign-template",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_pif_admin), Depends(verify_csrf)],
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

    a = TemplateAssignment(
        id=str(uuid.uuid4()),
        template_version_id=body.template_version_id,
        org_id=project_id,
        assigned_by=str(user.id),
        deadline=deadline_dt,
        submission_type="template",
        status="pending",
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return {"ok": True, "assignment_id": a.id}
