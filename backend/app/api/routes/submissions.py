"""Admin routes for submission review, download, and file update."""
from __future__ import annotations

import shutil
import uuid as _uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import get_current_user, verify_csrf
from app.core.rbac import require_admin
from app.db.session import get_db
from app.models.consolidated_sheet import ConsolidatedSheet
from app.models.organization import Organization
from app.models.profile import Profile
from app.models.submission import Submission
from app.schemas.subcontractor import SubmissionResponse, SubmissionReviewRequest
from app.services.kpi_report import generate_safety_kpi_report

router = APIRouter(
    prefix="/api/admin/submissions",
    tags=["submissions-admin"],
    dependencies=[Depends(require_admin), Depends(verify_csrf)],
)


@router.get("/{submission_id}/download")
def download_submission(
    submission_id: str,
    db: Session = Depends(get_db),
):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    path = Path(sub.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(
        path=str(path),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=sub.file_name,
    )


@router.post("/{submission_id}/review", response_model=SubmissionResponse)
def review_submission(
    submission_id: str,
    body: SubmissionReviewRequest,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.status not in ("approved", "changes_requested"):
        raise HTTPException(
            status_code=422,
            detail="status must be 'approved' or 'changes_requested'",
        )
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    sub.review_status = body.status
    sub.review_comment = body.comment
    sub.reviewed_by = user.id
    sub.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(sub)
    return sub


@router.put("/{submission_id}/file", response_model=SubmissionResponse)
async def update_submission_file(
    submission_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    dest = Path(sub.file_path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    sub.file_name = file.filename or sub.file_name
    db.commit()
    db.refresh(sub)
    return sub


@router.post("/{submission_id}/kpi-report")
def generate_kpi_report(
    submission_id: str,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    if not Path(sub.file_path).exists():
        raise HTTPException(status_code=404, detail="Submission file not found on disk")

    org = db.query(Organization).filter(Organization.id == sub.org_id).first()
    project_name = org.name if org else "DevCo"

    try:
        xlsx_bytes = generate_safety_kpi_report(sub.file_path, project_name)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"KPI report generation failed: {e}")

    settings = get_settings()
    out_dir = Path(settings.upload_dir) / "consolidated"
    out_dir.mkdir(parents=True, exist_ok=True)
    sheet_id = str(_uuid.uuid4())
    out_path = out_dir / f"{sheet_id}.xlsx"
    out_path.write_bytes(xlsx_bytes)

    report_name = f"KPI Safety Report — {project_name} — {datetime.now(timezone.utc).strftime('%b %d, %Y')}"
    sheet = ConsolidatedSheet(
        id=sheet_id,
        template_id=sub.assignment_id,
        project_id=sub.org_id,
        name=report_name,
        file_path=str(out_path),
        generated_by=str(user.id),
    )
    db.add(sheet)
    db.commit()

    return {"sheet_id": sheet_id, "name": report_name}
