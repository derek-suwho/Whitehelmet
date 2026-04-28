"""Assignment routes — distribute templates or freeform links to DevCos."""
import uuid, secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, verify_csrf
from app.db.session import get_db
from app.models.template_assignment import TemplateAssignment
from app.models.user import User
from app.schemas.admin import AssignmentCreate, AssignmentResponse

router = APIRouter(
    prefix="/api/assignments",
    tags=["assignments"],
    dependencies=[Depends(get_current_user), Depends(verify_csrf)],
)

@router.post("", response_model=list[AssignmentResponse], status_code=status.HTTP_201_CREATED)
def create_assignments(body: AssignmentCreate, user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    results = []

    if body.submission_type == "template":
        deadline_dt = datetime.fromisoformat(body.deadline) if body.deadline else None
        for org_id in body.org_ids:
            a = TemplateAssignment(
                id=str(uuid.uuid4()),
                template_version_id=body.template_version_id,
                org_id=org_id,
                assigned_by=str(user.id),
                deadline=deadline_dt,
                submission_type="template",
                status="pending",
            )
            db.add(a)
            results.append(a)
    else:
        # Freeform: generate upload token (valid 7 days)
        token = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + timedelta(days=7)
        a = TemplateAssignment(
            id=str(uuid.uuid4()),
            org_id=body.org_id or "",
            assigned_by=str(user.id),
            submission_type="freeform",
            instructions=body.instructions,
            deadline=datetime.fromisoformat(body.deadline) if body.deadline else None,
            status="pending",
            upload_token=token,
            upload_token_expires_at=expires,
        )
        db.add(a)
        results.append(a)

    db.commit()
    for a in results:
        db.refresh(a)
    return results
