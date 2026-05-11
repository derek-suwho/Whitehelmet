"""Admin routes for submission review, download, and file update."""
from __future__ import annotations

import os
import shutil
import tempfile
import uuid as _uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import openpyxl
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import get_current_user, verify_csrf
from app.core.rbac import require_admin
from app.db.session import get_db
from app.models.consolidated_sheet import ConsolidatedSheet
from app.models.organization import Organization
from app.models.profile import Profile
from app.models.submission import Submission
from app.models.template_assignment import TemplateAssignment
from app.models.template_formula import TemplateFormula
from app.schemas.subcontractor import SubmissionResponse, SubmissionReviewRequest
from app.services.formula_executor import FormulaExecutor
from app.services.kpi_report import generate_safety_kpi_report


class CellChange(BaseModel):
    row: int
    col: int
    value: Any = None


class CellPatchRequest(BaseModel):
    changes: list[CellChange]
    revision: int | None = None

router = APIRouter(
    prefix="/api/admin/submissions",
    tags=["submissions-admin"],
    dependencies=[Depends(require_admin), Depends(verify_csrf)],
)


@router.get("/{submission_id}")
def get_submission(
    submission_id: str,
    db: Session = Depends(get_db),
):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    return {
        "id": sub.id,
        "file_name": sub.file_name,
        "status": sub.status,
        "has_processed": sub.processed_file_path is not None,
        "file_revision": sub.file_revision,
        "review_status": sub.review_status,
        "review_comment": sub.review_comment,
        "reviewed_at": sub.reviewed_at.isoformat() if sub.reviewed_at else None,
    }


@router.get("/{submission_id}/download")
def download_submission(
    submission_id: str,
    type: str = "raw",
    db: Session = Depends(get_db),
):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    if type == "processed":
        if not sub.processed_file_path:
            raise HTTPException(status_code=404, detail="No processed file available")
        path = Path(sub.processed_file_path)
    else:
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


@router.patch("/{submission_id}/cells")
def patch_submission_cells(
    submission_id: str,
    body: CellPatchRequest,
    db: Session = Depends(get_db),
):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(404, "Submission not found")
    if not sub.processed_file_path:
        raise HTTPException(400, "No processed file to patch")

    # Optimistic concurrency check
    if body.revision is not None and body.revision != sub.file_revision:
        raise HTTPException(
            409,
            f"Stale revision (yours: {body.revision}, current: {sub.file_revision}). Reload and re-apply."
        )

    wb = openpyxl.load_workbook(sub.processed_file_path)
    ws = wb.active
    for change in body.changes:
        ws.cell(row=change.row, column=change.col, value=change.value)
    wb.save(sub.processed_file_path)

    sub.file_revision += 1
    db.commit()

    return {"status": "saved", "patches_applied": len(body.changes), "revision": sub.file_revision}


@router.post("/{submission_id}/recalculate")
def recalculate_submission(
    submission_id: str,
    db: Session = Depends(get_db),
):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    assignment = db.query(TemplateAssignment).filter(TemplateAssignment.id == sub.assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    formulas = db.query(TemplateFormula).filter(
        TemplateFormula.template_version_id == assignment.template_version_id
    ).order_by(TemplateFormula.target_row.asc()).all()

    if not formulas:
        raise HTTPException(status_code=400, detail="No formulas configured for this template")

    with open(sub.file_path, "rb") as f:
        raw_bytes = f.read()

    processed_bytes = FormulaExecutor.execute(raw_bytes, formulas)

    if sub.processed_file_path:
        target_path = sub.processed_file_path
    else:
        raw_path = Path(sub.file_path)
        target_path = str(raw_path.parent / f"{raw_path.stem}_processed{raw_path.suffix}")

    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".xlsx", dir=str(Path(target_path).parent))
    try:
        with os.fdopen(tmp_fd, "wb") as f:
            f.write(processed_bytes)
        shutil.move(tmp_path, target_path)
    except Exception:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise HTTPException(500, "Failed to write processed file")

    if not sub.processed_file_path:
        sub.processed_file_path = target_path
    sub.file_revision += 1
    db.commit()

    return {"status": "recalculated", "processed_file_path": sub.processed_file_path, "revision": sub.file_revision}
