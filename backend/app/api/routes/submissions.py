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
from app.core.paths import resolve_path, to_relative
from app.core.rbac import require_admin
from app.db.session import get_db
from app.models.consolidated_sheet import ConsolidatedSheet
from app.models.organization import Organization
from app.models.profile import Profile
from app.models.submission import Submission
from app.models.template_assignment import TemplateAssignment
from app.models.template_formula import TemplateFormula
from app.models.template_version import TemplateVersion
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
        path = resolve_path(sub.processed_file_path)
    else:
        path = resolve_path(sub.file_path)

    if not path or not path.exists():
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
    dest = resolve_path(sub.file_path)
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
    _raw_path = resolve_path(sub.file_path)
    if not _raw_path or not _raw_path.exists():
        raise HTTPException(status_code=404, detail="Submission file not found on disk")

    org = db.query(Organization).filter(Organization.id == sub.org_id).first()
    project_name = org.name if org else "DevCo"

    try:
        xlsx_bytes = generate_safety_kpi_report(str(_raw_path), project_name)
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
        file_path=to_relative(out_path),
        generated_by=str(user.id),
    )
    db.add(sheet)
    db.commit()

    return {"sheet_id": sheet_id, "name": report_name}


@router.delete("/{submission_id}", status_code=204)
def delete_submission(
    submission_id: str,
    db: Session = Depends(get_db),
):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    # Remove files from disk
    for path_attr in (sub.file_path, sub.processed_file_path):
        if path_attr:
            p = resolve_path(path_attr)
            if p and p.exists():
                p.unlink()
    db.delete(sub)
    db.commit()


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

    _proc_path = resolve_path(sub.processed_file_path)
    wb = openpyxl.load_workbook(str(_proc_path))
    ws = wb.active
    for change in body.changes:
        ws.cell(row=change.row, column=change.col, value=change.value)
    wb.save(str(_proc_path))

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

    _raw_abs = resolve_path(sub.file_path)
    with open(str(_raw_abs), "rb") as f:
        raw_bytes = f.read()

    tv = db.query(TemplateVersion).filter(TemplateVersion.id == assignment.template_version_id).first()
    hr = (tv.header_row or 1) if tv else 1
    processed_bytes = FormulaExecutor.execute(raw_bytes, formulas, header_row=hr)

    if sub.processed_file_path:
        target_abs = resolve_path(sub.processed_file_path)
    else:
        target_abs = _raw_abs.parent / f"{_raw_abs.stem}_processed{_raw_abs.suffix}"

    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".xlsx", dir=str(target_abs.parent))
    try:
        with os.fdopen(tmp_fd, "wb") as f:
            f.write(processed_bytes)
        shutil.move(tmp_path, str(target_abs))
    except Exception:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise HTTPException(500, "Failed to write processed file")

    if not sub.processed_file_path:
        sub.processed_file_path = to_relative(target_abs)
    sub.file_revision += 1
    db.commit()

    return {"status": "recalculated", "processed_file_path": sub.processed_file_path, "revision": sub.file_revision}
