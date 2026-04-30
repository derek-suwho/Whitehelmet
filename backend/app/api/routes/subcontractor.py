"""Subcontractor portal routes — assignment list, template download, file upload."""

from __future__ import annotations

import json
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse as FastAPIFileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import get_current_user, verify_csrf
from app.core.rbac import require_subcontractor
from app.core.security import hash_file
from app.db.session import get_db
from app.models.submission import Submission
from app.models.template import Template
from app.models.template_assignment import TemplateAssignment
from app.models.template_version import TemplateVersion
from app.models.user import User
from app.schemas.subcontractor import AssignmentForSubcontractor, SubmissionResponse

ALLOWED_EXTENSIONS = {".xlsx", ".xls"}

router = APIRouter(
    prefix="/api/subcontractor",
    tags=["subcontractor"],
    dependencies=[Depends(require_subcontractor)],
)

def _assignment_filter(user: User):
    """Return an OR filter matching project-wide assignments OR user-targeted ones."""
    return or_(
        (TemplateAssignment.org_id == user.org_id) & (TemplateAssignment.assigned_to_user_id == None),
        TemplateAssignment.assigned_to_user_id == str(user.id),
    )


# ── 1. List assignments for this org/user ────────────────────────────────────

@router.get("/assignments", response_model=list[AssignmentForSubcontractor])
def list_my_assignments(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return template assignments for this user — project-wide or directly targeted."""
    if not user.org_id:
        raise HTTPException(status_code=400, detail="User has no org_id assigned")

    assignments = (
        db.query(TemplateAssignment)
        .filter(
            TemplateAssignment.submission_type == "template",
            _assignment_filter(user),
        )
        .order_by(TemplateAssignment.assigned_at.desc())
        .all()
    )

    result = []
    for a in assignments:
        template_name = None
        if a.template_version_id:
            ver = db.query(TemplateVersion).filter(
                TemplateVersion.id == a.template_version_id
            ).first()
            if ver:
                tmpl = db.query(Template).filter(Template.id == ver.template_id).first()
                template_name = tmpl.name if tmpl else None

        has_submission = (
            db.query(Submission)
            .filter(
                Submission.assignment_id == a.id,
                Submission.submitted_by == str(user.id),
            )
            .first()
        ) is not None

        # Derive per-user status: locked is set by PM and is authoritative;
        # otherwise reflect whether THIS user has submitted, not the shared assignment.
        if a.status == "locked":
            user_status = "locked"
        else:
            user_status = "submitted" if has_submission else "pending"

        result.append(
            AssignmentForSubcontractor(
                id=a.id,
                template_version_id=a.template_version_id,
                deadline=a.deadline,
                instructions=a.instructions,
                status=user_status,
                assigned_at=a.assigned_at,
                template_name=template_name,
                has_submission=has_submission,
            )
        )
    return result


# ── 2. Download the template Excel for an assignment ─────────────────────────

@router.get("/assignments/{assignment_id}/template-download")
def download_template(
    assignment_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate and serve an xlsx template from the PM's template schema."""
    if not user.org_id:
        raise HTTPException(status_code=400, detail="User has no org_id assigned")

    a = db.query(TemplateAssignment).filter(
        TemplateAssignment.id == assignment_id,
        _assignment_filter(user),
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if not a.template_version_id:
        raise HTTPException(status_code=400, detail="No template linked to this assignment")

    ver = db.query(TemplateVersion).filter(
        TemplateVersion.id == a.template_version_id
    ).first()
    if not ver:
        raise HTTPException(status_code=404, detail="Template version not found")

    import openpyxl

    schema = ver.schema_json if isinstance(ver.schema_json, dict) else json.loads(ver.schema_json)
    columns = [col.get("name", col) for col in schema.get("columns", [])]
    if not columns:
        columns = list(schema.keys()) if isinstance(schema, dict) else []

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Submission"
    if columns:
        ws.append(columns)

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx")
    wb.save(tmp.name)
    tmp.close()

    tmpl = db.query(Template).filter(Template.id == ver.template_id).first()
    safe_name = (tmpl.name.replace(" ", "_") if tmpl else "template") + ".xlsx"

    return FastAPIFileResponse(
        path=tmp.name,
        filename=safe_name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


# ── 3. Upload submission for an assignment ────────────────────────────────────

@router.post(
    "/assignments/{assignment_id}/submit",
    response_model=SubmissionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
async def submit_file(
    assignment_id: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload an xlsx against an assignment. Resubmission replaces the prior file."""
    if not user.org_id:
        raise HTTPException(status_code=400, detail="User has no org_id assigned")

    a = db.query(TemplateAssignment).filter(
        TemplateAssignment.id == assignment_id,
        _assignment_filter(user),
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if a.status == "locked":
        raise HTTPException(status_code=409, detail="Assignment is locked; no further submissions accepted")

    settings = get_settings()
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only .xlsx/.xls files are allowed")

    content = await file.read()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.max_upload_size_mb} MB limit")
    if content[:4] != b"PK\x03\x04":
        raise HTTPException(status_code=400, detail="File does not appear to be a valid xlsx")

    sha = hash_file(content)
    org_dir = Path(settings.upload_dir) / "submissions" / str(user.org_id)
    org_dir.mkdir(parents=True, exist_ok=True)
    stored_path = org_dir / f"{sha}{ext}"
    stored_path.write_bytes(content)

    existing = db.query(Submission).filter(
        Submission.assignment_id == assignment_id,
        Submission.submitted_by == str(user.id),
    ).first()

    if existing:
        existing.file_path = str(stored_path)
        existing.file_name = file.filename or "submission.xlsx"
        existing.submitted_by = str(user.id)
        sub = existing
    else:
        sub = Submission(
            id=str(uuid.uuid4()),
            assignment_id=assignment_id,
            org_id=user.org_id,
            file_path=str(stored_path),
            file_name=file.filename or "submission.xlsx",
            status="submitted",
            submitted_by=str(user.id),
        )
        db.add(sub)

    a.status = "submitted"
    db.commit()
    db.refresh(sub)
    return sub


# ── 4. List own submission history ───────────────────────────────────────────

@router.get("/submissions", response_model=list[SubmissionResponse])
def list_my_submissions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all submissions made by this user, newest first."""
    return (
        db.query(Submission)
        .filter(Submission.submitted_by == str(user.id))
        .order_by(Submission.submitted_at.desc())
        .all()
    )
