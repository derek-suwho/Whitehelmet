"""Admin routes — user management and consolidation progress."""

import io
import json
import openpyxl
import uuid as _uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import get_current_user, verify_csrf
from app.core.rbac import require_pif_admin
from app.db.session import get_db
from app.models.consolidated_sheet import ConsolidatedSheet
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.submission import Submission
from app.models.template import Template
from app.models.template_assignment import TemplateAssignment
from app.models.template_formula import TemplateFormula
from app.models.template_version import TemplateVersion
from app.models.user import User
from app.schemas.admin import UserWithOrgResponse, UpdateRoleRequest
from app.schemas.subcontractor import ConsolidationProgressResponse, OrgSubmissionStatus
from app.schemas.template_formula import (
    TemplateFormulaCreate, TemplateFormulaUpdate, TemplateFormulaResponse,
)

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
        member_count = 0

        for m in members:
            user = db.query(User).filter(User.id == m.user_id).first()
            if not user:
                continue
            member_count += 1

            subs = []
            if assignment_ids:
                subs = (
                    db.query(Submission)
                    .filter(
                        Submission.assignment_id.in_(assignment_ids),
                        Submission.submitted_by == str(user.id),
                    )
                    .order_by(Submission.submitted_at.desc())
                    .all()
                )

            if subs:
                submitted_count += 1
                for sub in subs:
                    org_rows.append(
                        OrgSubmissionStatus(
                            org_id=str(user.id),
                            org_name=user.display_name,
                            assignment_id=sub.assignment_id,
                            assignment_status="submitted",
                            submission_id=sub.id,
                            submitted_at=sub.submitted_at,
                            file_name=sub.file_name,
                        )
                    )
            else:
                org_rows.append(
                    OrgSubmissionStatus(
                        org_id=str(user.id),
                        org_name=user.display_name,
                        assignment_id=None,
                        assignment_status="pending",
                        submission_id=None,
                        submitted_at=None,
                        file_name=None,
                    )
                )

        return ConsolidationProgressResponse(
            template_id=template_id,
            template_version_id=None,
            total_orgs=member_count,
            submitted_count=submitted_count,
            all_submitted=submitted_count == member_count and member_count > 0,
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


@router.get(
    "/projects/{project_id}/submission-overview",
    dependencies=[Depends(require_pif_admin)],
)
def get_project_submission_overview(project_id: str, db: Session = Depends(get_db)):
    """Return cross-template submission counts for a project.

    Overall: total expected (members × templates) and total received.
    Per-template: submitted_count and total_members for each template assigned to the project.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
    member_users = [
        db.query(User).filter(User.id == m.user_id).first() for m in members
    ]
    member_users = [u for u in member_users if u]
    total_members = len(member_users)

    # All template version assignments for this project (project-wide org_id assignments)
    project_assignments = (
        db.query(TemplateAssignment)
        .filter(TemplateAssignment.org_id == project_id)
        .all()
    )

    # Resolve unique templates via template_version → template
    seen_template_ids: set[str] = set()
    templates_progress = []

    for assignment in project_assignments:
        if not assignment.template_version_id:
            continue
        version = db.query(TemplateVersion).filter(
            TemplateVersion.id == assignment.template_version_id
        ).first()
        if not version:
            continue
        template = db.query(Template).filter(Template.id == version.template_id).first()
        if not template or template.id in seen_template_ids:
            continue
        seen_template_ids.add(template.id)

        # All assignment IDs for this template in this project
        t_assignment_ids = [
            a.id for a in db.query(TemplateAssignment).filter(
                TemplateAssignment.org_id == project_id,
                TemplateAssignment.template_version_id == version.id,
            ).all()
        ]

        submitted_count = sum(
            1 for u in member_users
            if db.query(Submission).filter(
                Submission.assignment_id.in_(t_assignment_ids),
                Submission.submitted_by == str(u.id),
            ).first()
        )

        templates_progress.append({
            "template_id": template.id,
            "template_name": template.name,
            "total_members": total_members,
            "submitted_count": submitted_count,
            "all_submitted": submitted_count == total_members and total_members > 0,
        })

    total_expected = total_members * len(templates_progress)
    total_submitted = sum(t["submitted_count"] for t in templates_progress)

    return {
        "total_members": total_members,
        "total_expected": total_expected,
        "total_submitted": total_submitted,
        "all_submitted": total_submitted == total_expected and total_expected > 0,
        "templates": templates_progress,
    }


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

    from app.api.routes.ai import _expand_merged

    # Sheets to always skip (utility / formula / metadata sheets)
    _SKIP_SHEETS = (
        "dropdown", "instruction", "readme", "legend", "lookup", "ref", "notes",
        "calculation sheet", "calculation", "formula", "sheet1",
        "company infomation", "company information", "company info",
        "wbs", "contracts", "construction cost", "milestones",
        "progress", "assets", "observations",
    )
    # Preferred DevCo input sheet names — checked in order; first match wins
    _PREFERRED = ("ard", "quality", "data", "input", "kpi", "hse", "safety", "metrics")

    def _best_header_row(rows: list) -> tuple:
        """Return the most likely column-name row in the first 30 rows.

        Scoring: most DISTINCT non-empty strings wins. Ties broken by shortest
        average string length — column names (e.g. '#', 'Level 1') are short,
        description/preamble rows use full sentences, so the column-names row
        wins even when both rows have the same number of distinct strings."""
        best_idx, best_row, best_count, best_avg = 0, rows[0] if rows else [], 0, float('inf')
        for idx, row in enumerate(rows[:30]):
            strings = [str(v).strip() for v in row
                       if v is not None and isinstance(v, str) and str(v).strip()]
            distinct = len(set(strings))
            avg_len = sum(len(s) for s in strings) / len(strings) if strings else float('inf')
            if distinct > best_count or (distinct == best_count and avg_len < best_avg):
                best_count, best_idx, best_row, best_avg = distinct, idx, row, avg_len
        return best_idx, best_row

    def _pick_sheet(wb):
        """Return (sheet_name, rows, header_idx, header_row) for the DevCo input sheet."""
        candidates = {}
        for name in wb.sheetnames:
            if any(kw in name.lower() for kw in _SKIP_SHEETS):
                continue
            ws = wb[name]
            if ws.max_row is None or ws.max_row < 2:
                continue
            rows = _expand_merged(ws)
            hidx, hrow = _best_header_row(rows)
            useful = [v for v in hrow if v is not None and str(v).strip()]
            if len(useful) < 3:
                continue
            data = [r for r in rows[hidx + 1:] if any(c is not None and str(c).strip() for c in r)]
            if not data:
                continue
            candidates[name] = (name, rows, hidx, hrow, len(useful))

        # Prefer known input sheet names (order matters: "ard" before "quality")
        for keyword in _PREFERRED:
            for name, val in candidates.items():
                if keyword in name.lower():
                    return val
        # Fall back to the sheet with the most header columns
        if candidates:
            return max(candidates.values(), key=lambda c: c[4])
        return None

    # Parse each xlsx
    file_schemas = []
    all_file_data = []
    for sub in submissions:
        path = Path(sub.processed_file_path or sub.file_path)
        if not path.exists():
            continue
        try:
            wb = openpyxl.load_workbook(path, data_only=True)
            picked = _pick_sheet(wb)
            if not picked:
                continue
            _, rows, header_idx, header_row, _ = picked

            # Truncate verbose header strings — KPI templates use full sentences as column names
            headers = [str(h).strip()[:80] if h is not None else '' for h in header_row]

            def _nonempty(v) -> bool:
                return v is not None and str(v).strip() != ''

            def _coerce(v):
                """Preserve native numeric types; only stringify text."""
                if v is None:
                    return None
                if isinstance(v, (int, float)):
                    return v
                s = str(v).strip()
                if s == '':
                    return None
                try:
                    return int(s)
                except ValueError:
                    pass
                try:
                    return float(s)
                except ValueError:
                    return s

            # Keep rows with ≥3 non-empty cells AND >1 distinct value
            # (excludes sparse sequence-number rows and label rows like "KPI Ratings" repeated)
            data_rows = [
                [_coerce(c) for c in r]
                for r in rows[header_idx + 1:]
                if (
                    sum(1 for c in r if _nonempty(c)) >= 3
                    and len({str(c) for c in r if _nonempty(c)}) > 1
                )
            ]
            if not data_rows:
                continue

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
        "max_tokens": 8192,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps([
                {"name": f["name"], "headers": f["headers"], "sample_rows": f["sample_rows"][:3]}
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

    # Merge rows — emit None for missing values so Excel leaves the cell blank
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
                val = row[idx] if idx is not None and idx < len(row) else None
                out.append(val)
            merged_rows.append(out)

    # Write output xlsx — values are already native Python types (int/float/str/None)
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


# ── Assignment Lock / Unlock ─────────────────────────────────────────────────

class AssignmentLockResponse(BaseModel):
    id: str
    status: str
    locked_at: Optional[datetime] = None
    locked_by: Optional[str] = None

    model_config = {"from_attributes": True}


@router.post("/assignments/{assignment_id}/lock", response_model=AssignmentLockResponse)
def lock_assignment(
    assignment_id: str,
    user: User = Depends(require_pif_admin),
    db: Session = Depends(get_db),
):
    """Lock a submission — no further uploads accepted from the DevCo."""
    a = db.query(TemplateAssignment).filter(TemplateAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if a.status == "locked":
        raise HTTPException(status_code=409, detail="Assignment already locked")
    a.status = "locked"
    a.locked_at = datetime.utcnow()
    a.locked_by = str(user.id)
    db.commit()
    db.refresh(a)
    return a


@router.post("/assignments/{assignment_id}/unlock", response_model=AssignmentLockResponse)
def unlock_assignment(
    assignment_id: str,
    user: User = Depends(require_pif_admin),
    db: Session = Depends(get_db),
):
    """Unlock a submission — allows DevCo to resubmit."""
    a = db.query(TemplateAssignment).filter(TemplateAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    a.status = "submitted"
    a.locked_at = None
    a.locked_by = None
    db.commit()
    db.refresh(a)
    return a


# ── Template Formula CRUD ────────────────────────────────────────────────────

@router.get(
    "/template-versions/{version_id}/formulas",
    response_model=list[TemplateFormulaResponse],
)
def list_formulas(
    version_id: str,
    user: User = Depends(require_pif_admin),
    db: Session = Depends(get_db),
):
    return db.query(TemplateFormula).filter(
        TemplateFormula.template_version_id == version_id
    ).all()


@router.post(
    "/template-versions/{version_id}/formulas",
    response_model=TemplateFormulaResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_formula(
    version_id: str,
    body: TemplateFormulaCreate,
    user: User = Depends(require_pif_admin),
    db: Session = Depends(get_db),
):
    import uuid as _u
    f = TemplateFormula(
        id=str(_u.uuid4()),
        template_version_id=version_id,
        name=body.name,
        target_column=body.target_column,
        formula_type=body.formula_type,
        expression=body.expression,
        weight=body.weight,
        benchmark=body.benchmark,
        scoring_rules=json.dumps(body.scoring_rules) if body.scoring_rules is not None else None,
        created_by=str(user.id),
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


@router.put("/formulas/{formula_id}", response_model=TemplateFormulaResponse)
def update_formula(
    formula_id: str,
    body: TemplateFormulaUpdate,
    user: User = Depends(require_pif_admin),
    db: Session = Depends(get_db),
):
    f = db.query(TemplateFormula).filter(TemplateFormula.id == formula_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Formula not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        if field == "scoring_rules" and val is not None:
            val = json.dumps(val)
        setattr(f, field, val)
    db.commit()
    db.refresh(f)
    return f


@router.delete("/formulas/{formula_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_formula(
    formula_id: str,
    user: User = Depends(require_pif_admin),
    db: Session = Depends(get_db),
):
    f = db.query(TemplateFormula).filter(TemplateFormula.id == formula_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Formula not found")
    db.delete(f)
    db.commit()
