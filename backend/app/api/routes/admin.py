"""Admin routes — user management and consolidation progress."""

import io
import json
import openpyxl
import uuid as _uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import get_current_user, verify_csrf
from app.core.rbac import require_pif_admin
from app.db.session import get_db
from app.models.consolidated_sheet import ConsolidatedSheet
from app.models.project import Project
from app.models.project_member import ProjectMember
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
    project_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Return per-org submission status.

    When project_id is supplied (master-template context) the response lists
    each project member and their most recent submission.  Otherwise the
    existing assignment-based logic is used.
    """
    if project_id:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        members = (
            db.query(ProjectMember)
            .filter(ProjectMember.project_id == project_id)
            .all()
        )

        assignment_ids = [
            a.id for a in db.query(TemplateAssignment)
            .filter(TemplateAssignment.org_id == project_id)
            .all()
        ]

        org_rows: list[OrgSubmissionStatus] = []
        submitted_count = 0

        for m in members:
            user = db.query(User).filter(User.id == m.user_id).first()
            if not user:
                continue

            sub = None
            if assignment_ids:
                sub = (
                    db.query(Submission)
                    .filter(
                        Submission.assignment_id.in_(assignment_ids),
                        Submission.submitted_by == str(user.id),
                    )
                    .order_by(Submission.submitted_at.desc())
                    .first()
                )

            status_val = "submitted" if sub else "pending"
            if sub:
                submitted_count += 1

            org_rows.append(
                OrgSubmissionStatus(
                    org_id=str(user.id),
                    org_name=user.display_name,
                    assignment_id=sub.assignment_id if sub else None,
                    assignment_status=status_val,
                    submission_id=sub.id if sub else None,
                    submitted_at=sub.submitted_at if sub else None,
                    file_name=sub.file_name if sub else None,
                )
            )

        return ConsolidationProgressResponse(
            template_id=template_id,
            template_version_id=None,
            total_orgs=len(org_rows),
            submitted_count=submitted_count,
            all_submitted=submitted_count == len(org_rows) and len(org_rows) > 0,
            orgs=org_rows,
        )

    # Assignment-based mode (subcontractor templates)
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

    org_rows = []
    submitted_count = 0

    for a in assignments:
        project = db.query(Project).filter(Project.id == a.org_id).first()
        subs = (
            db.query(Submission)
            .filter(Submission.assignment_id == a.id)
            .order_by(Submission.submitted_at.desc())
            .all()
        )

        if subs:
            # One row per submitter so every file is visible and selectable
            for sub in subs:
                submitted_count += 1
                submitter = db.query(User).filter(User.id == sub.submitted_by).first()
                display = submitter.display_name if submitter else (project.name if project else a.org_id)
                org_rows.append(
                    OrgSubmissionStatus(
                        org_id=sub.submitted_by or a.org_id,
                        org_name=display,
                        assignment_id=a.id,
                        assignment_status="submitted",
                        submission_id=sub.id,
                        submitted_at=sub.submitted_at,
                        file_name=sub.file_name,
                    )
                )
        else:
            org_rows.append(
                OrgSubmissionStatus(
                    org_id=a.org_id,
                    org_name=project.name if project else a.org_id,
                    assignment_id=a.id,
                    assignment_status=a.status,
                    submission_id=None,
                    submitted_at=None,
                    file_name=None,
                )
            )

    return ConsolidationProgressResponse(
        template_id=template_id,
        template_version_id=latest_ver.id if latest_ver else None,
        total_orgs=len(org_rows),
        submitted_count=submitted_count,
        all_submitted=submitted_count == len(assignments) and len(assignments) > 0,
        orgs=org_rows,
    )


@router.post(
    "/templates/{template_id}/consolidate-submissions",
    dependencies=[Depends(require_pif_admin), Depends(verify_csrf)],
)
async def consolidate_submissions(
    template_id: str,
    body: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Load project submission files, run AI schema unification, save ConsolidatedSheet."""
    from app.api.routes.ai import _ai_post

    settings = get_settings()
    project_id: Optional[str] = body.get("project_id")
    submission_ids: Optional[list] = body.get("submission_ids")

    if submission_ids:
        submissions = db.query(Submission).filter(Submission.id.in_(submission_ids)).all()
    elif project_id:
        aids = [
            a.id for a in db.query(TemplateAssignment)
            .filter(TemplateAssignment.org_id == project_id)
            .all()
        ]
        submissions = (
            db.query(Submission).filter(Submission.assignment_id.in_(aids)).all()
            if aids else []
        )
    else:
        raise HTTPException(status_code=400, detail="project_id or submission_ids required")

    if not submissions:
        raise HTTPException(status_code=400, detail="No submissions to consolidate")

    # Parse each xlsx
    file_schemas = []
    all_file_data = []
    for sub in submissions:
        path = Path(sub.file_path)
        if not path.exists():
            continue
        try:
            wb = openpyxl.load_workbook(path, data_only=True)
            ws = wb.active
            raw = list(ws.iter_rows(values_only=True))
            if not raw:
                continue
            headers = [str(h) if h is not None else '' for h in raw[0]]
            data_rows = [
                [str(c) if c is not None else '' for c in r]
                for r in raw[1:]
                if any(c is not None for c in r)
            ]
            file_schemas.append({"name": sub.file_name, "headers": headers, "sample_rows": data_rows[:5]})
            all_file_data.append({"name": sub.file_name, "headers": headers, "all_rows": data_rows})
        except Exception:
            continue

    if not all_file_data:
        raise HTTPException(status_code=400, detail="Could not read any submission files")

    # AI schema unification
    system_prompt = (
        "You are a spreadsheet schema unifier. "
        "Given headers and sample rows from multiple Excel files, "
        "return ONLY a valid JSON object — no markdown, no extra text:\n"
        '{"unified_headers":["Source File","<col>",...],'
        '"mappings":[{"file":"<name>","column_map":{"<src>":"<unified>"}}]}\n\n'
        "Rules:\n"
        "- Always include \"Source File\" as the first unified header.\n"
        "- Merge columns that represent the same concept under one standard name.\n"
        "- Include every column that appears in at least one file.\n"
        "- column_map must cover every source column in that file."
    )
    ai_data = await _ai_post({
        "model": "anthropic/claude-sonnet-4-5",
        "max_tokens": 2048,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps([
                {"name": f["name"], "headers": f["headers"], "sample_rows": f["sample_rows"]}
                for f in file_schemas
            ])},
        ],
    })

    raw_ai = ai_data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
    raw_ai = raw_ai.strip()
    if raw_ai.startswith("```"):
        raw_ai = raw_ai.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    try:
        schema = json.loads(raw_ai)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail=f"AI returned invalid schema: {exc}")

    unified_headers = schema.get("unified_headers", ["Source File"])
    mappings = {m["file"]: m.get("column_map", {}) for m in schema.get("mappings", [])}

    # Merge rows
    merged_rows = []
    for f in all_file_data:
        col_map = mappings.get(f["name"], {})
        unified_to_idx: dict[str, int] = {}
        for src, unified in col_map.items():
            try:
                unified_to_idx[unified] = f["headers"].index(src)
            except ValueError:
                pass
        for row in f["all_rows"]:
            out = [f["name"]]
            for h in unified_headers[1:]:
                idx = unified_to_idx.get(h)
                out.append(row[idx] if idx is not None and idx < len(row) else "")
            merged_rows.append(out)

    # Write output xlsx
    wb_out = openpyxl.Workbook()
    ws_out = wb_out.active
    ws_out.title = "Consolidated"
    ws_out.append(unified_headers)
    for row in merged_rows:
        ws_out.append(row)

    out_dir = Path(settings.upload_dir) / "consolidated"
    out_dir.mkdir(parents=True, exist_ok=True)
    sheet_id = str(_uuid.uuid4())
    out_path = out_dir / f"{sheet_id}.xlsx"
    wb_out.save(out_path)

    sheet = ConsolidatedSheet(
        id=sheet_id,
        template_id=template_id,
        file_path=str(out_path),
        generated_by=str(user.id),
    )
    db.add(sheet)
    db.commit()

    return {
        "consolidated_sheet_id": sheet_id,
        "file_path": str(out_path),
        "template_count": len(all_file_data),
        "freeform_count": 0,
    }
