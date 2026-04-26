"""Admin routes — user management and consolidation progress."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, verify_csrf
from app.core.rbac import require_pif_admin
from app.db.session import get_db
from app.models.organization import Organization
from app.models.submission import Submission
from app.models.template_assignment import TemplateAssignment
from app.models.template_version import TemplateVersion
from app.models.user import User
from app.schemas.admin import UserWithOrgResponse, UpdateRoleRequest
from app.schemas.subcontractor import ConsolidationProgressResponse, OrgSubmissionStatus

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/users", response_model=list[UserWithOrgResponse])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.display_name).all()


@router.patch(
    "/users/{user_id}/role",
    response_model=UserWithOrgResponse,
    dependencies=[Depends(verify_csrf)],
)
def update_user_role(
    user_id: int, body: UpdateRoleRequest, db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = body.role
    db.commit()
    db.refresh(user)
    return user


@router.get(
    "/templates/{template_id}/consolidation-progress",
    response_model=ConsolidationProgressResponse,
    dependencies=[Depends(require_pif_admin)],
)
def get_consolidation_progress(
    template_id: str,
    db: Session = Depends(get_db),
):
    """Return per-org submission status for all assignments under a template."""
    latest_ver = (
        db.query(TemplateVersion)
        .filter(TemplateVersion.template_id == template_id)
        .order_by(TemplateVersion.version_number.desc())
        .first()
    )

    assignments = []
    if latest_ver:
        assignments = (
            db.query(TemplateAssignment)
            .filter(
                TemplateAssignment.template_version_id == latest_ver.id,
                TemplateAssignment.submission_type == "template",
            )
            .all()
        )

    org_rows: list[OrgSubmissionStatus] = []
    submitted_count = 0

    for a in assignments:
        org = db.query(Organization).filter(Organization.id == a.org_id).first()
        sub = (
            db.query(Submission)
            .filter(Submission.assignment_id == a.id)
            .order_by(Submission.submitted_at.desc())
            .first()
        )

        if a.status in ("submitted", "locked"):
            submitted_count += 1

        org_rows.append(
            OrgSubmissionStatus(
                org_id=a.org_id,
                org_name=org.name if org else a.org_id,
                assignment_id=a.id,
                assignment_status=a.status,
                submission_id=sub.id if sub else None,
                submitted_at=sub.submitted_at if sub else None,
                file_name=sub.file_name if sub else None,
            )
        )

    return ConsolidationProgressResponse(
        template_id=template_id,
        template_version_id=latest_ver.id if latest_ver else None,
        total_orgs=len(assignments),
        submitted_count=submitted_count,
        all_submitted=submitted_count == len(assignments) and len(assignments) > 0,
        orgs=org_rows,
    )
