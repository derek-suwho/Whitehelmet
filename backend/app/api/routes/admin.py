"""Admin routes — user management and consolidation progress."""

from __future__ import annotations

import json
import uuid as _uuid
from datetime import datetime, timezone
from pathlib import Path

import openpyxl
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import get_current_user, verify_csrf
from app.core.rbac import require_admin
from app.db.session import get_db
from app.models.consolidated_sheet import ConsolidatedSheet
from app.models.profile import Profile
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.submission import Submission
from app.models.template import Template
from app.models.template_assignment import TemplateAssignment
from app.models.template_formula import TemplateFormula
from app.models.template_version import TemplateVersion
from app.schemas.admin import UpdateOrgRequest, UpdateRoleRequest, UserWithOrgResponse
from app.schemas.subcontractor import ConsolidationProgressResponse, OrgSubmissionStatus
from app.schemas.template_formula import (
    TemplateFormulaCreate,
    TemplateFormulaResponse,
    TemplateFormulaUpdate,
)

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/users", response_model=list[UserWithOrgResponse], dependencies=[Depends(require_admin)])
def list_users(db: Session = Depends(get_db)):
    profiles = db.query(Profile).order_by(Profile.display_name).all()
    from app.models.project_member import ProjectMember
    from app.models.project import Project
    result = []
    all_memberships = db.query(ProjectMember).all()
    all_projects = {proj.id: proj for proj in db.query(Project).all()}
    memberships_by_user: dict = {}
    for pm in all_memberships:
        memberships_by_user.setdefault(str(pm.user_id), []).append(pm)

    for p in profiles:
        user_memberships = memberships_by_user.get(str(p.id), [])
        projects = []
        for pm in user_memberships:
            proj = all_projects.get(pm.project_id)
            if proj:
                projects.append({
                    "project_id": proj.id,
                    "project_name": proj.name,
                    "membership_id": pm.id,
                    "participant_role": pm.participant_role,
                })
        project_name = projects[0]["project_name"] if projects else None
        participant_role = projects[0]["participant_role"] if projects else None
        result.append(UserWithOrgResponse(
            id=str(p.id),
            display_name=p.display_name,
            email=p.email,
            role=p.role,
            org_id=str(p.org_id) if p.org_id else None,
            org_name=p.org_name,
            project_name=project_name,
            participant_role=participant_role,
            projects=projects,
        ))
    return result


@router.patch(
    "/orgs/{org_id}/name",
    dependencies=[Depends(require_admin), Depends(verify_csrf)],
)
def update_org_name(org_id: str, body: UpdateOrgRequest, db: Session = Depends(get_db)):
    """Set org_name for all profiles with this org_id."""
    updated = db.query(Profile).filter(Profile.org_id == org_id).update(
        {"org_name": body.org_name.strip()}, synchronize_session=False
    )
    db.commit()
    return {"ok": True, "updated_users": updated}


@router.patch(
    "/users/{user_id}/role",
    response_model=UserWithOrgResponse,
    dependencies=[Depends(require_admin), Depends(verify_csrf)],
)
def update_user_role(user_id: str, body: UpdateRoleRequest, db: Session = Depends(get_db)):
    from app.models.project_member import ProjectMember
    user = db.query(Profile).filter(Profile.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = body.role
    if body.participant_role and body.role == "participant":
        valid_roles = {"focal", "member", "viewer"}
        if body.participant_role in valid_roles:
            db.query(ProjectMember).filter(ProjectMember.user_id == user_id).update(
                {"participant_role": body.participant_role}, synchronize_session=False
            )
    db.commit()
    db.refresh(user)
    # Return with projects populated
    memberships = db.query(ProjectMember).filter(ProjectMember.user_id == user_id).all()
    from app.models.project import Project
    all_projects = {p.id: p for p in db.query(Project).all()}
    projects = []
    for pm in memberships:
        proj = all_projects.get(pm.project_id)
        if proj:
            projects.append({"project_id": proj.id, "project_name": proj.name,
                             "membership_id": pm.id, "participant_role": pm.participant_role})
    participant_role = projects[0]["participant_role"] if projects else None
    return UserWithOrgResponse(
        id=str(user.id), display_name=user.display_name, email=user.email,
        role=user.role, org_id=str(user.org_id) if user.org_id else None,
        project_name=projects[0]["project_name"] if projects else None,
        participant_role=participant_role, projects=projects,
    )


@router.get("/orgs", dependencies=[Depends(require_admin)])
def list_orgs(db: Session = Depends(get_db)):
    """Return distinct orgs derived from participant profiles, with member names."""
    participants = db.query(Profile).filter(
        Profile.role == "participant", Profile.org_id.isnot(None)
    ).order_by(Profile.display_name).all()
    orgs: dict = {}
    for p in participants:
        oid = str(p.org_id)
        if oid not in orgs:
            orgs[oid] = {"org_id": oid, "org_name": p.org_name, "members": []}
        orgs[oid]["members"].append({"display_name": p.display_name, "email": p.email})
    return list(orgs.values())


class AssignToOrgRequest(BaseModel):
    template_version_id: str
    org_ids: list[str]
    deadline: str | None = None


@router.post("/assign-template-to-org", status_code=201, dependencies=[Depends(require_admin), Depends(verify_csrf)])
def assign_template_to_org(
    body: AssignToOrgRequest,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Assign a template version to one or more orgs (org_id, not project_id)."""
    from datetime import datetime
    deadline_dt = datetime.fromisoformat(body.deadline) if body.deadline else None
    created = []
    for org_id in body.org_ids:
        existing = db.query(TemplateAssignment).filter(
            TemplateAssignment.org_id == org_id,
            TemplateAssignment.template_version_id == body.template_version_id,
            TemplateAssignment.assigned_to_user_id.is_(None),
        ).first()
        if existing:
            continue
        a = TemplateAssignment(
            id=str(_uuid.uuid4()),
            template_version_id=body.template_version_id,
            org_id=org_id,
            assigned_by=str(user.id),
            deadline=deadline_dt,
            submission_type="template",
            status="pending",
            assigned_to_user_id=None,
        )
        db.add(a)
        created.append(org_id)
    db.commit()
    return {"ok": True, "assigned_to": created}


@router.get(
    "/templates/{template_id}/consolidation-progress",
    response_model=ConsolidationProgressResponse,
    dependencies=[Depends(require_admin)],
)
def get_consolidation_progress(
    template_id: str,
    project_id: str | None = Query(None),
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

        members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()

        assignment_ids = [
            a.id for a in db.query(TemplateAssignment).filter(TemplateAssignment.org_id == project_id).all()
        ]

        _proj_member_ids = [m.user_id for m in members]
        _proj_profiles = (
            {p.id: p for p in db.query(Profile).filter(Profile.id.in_(_proj_member_ids)).all()}
            if _proj_member_ids
            else {}
        )

        org_rows: list[OrgSubmissionStatus] = []
        submitted_count = 0
        member_count = 0

        for m in members:
            user = _proj_profiles.get(m.user_id)
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
            db.query(Submission).filter(Submission.assignment_id == a.id).order_by(Submission.submitted_at.desc()).all()
        )

        if subs:
            # One row per submitter so every file is visible and selectable
            for sub in subs:
                submitted_count += 1
                submitter = db.query(Profile).filter(Profile.id == sub.submitted_by).first()
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
    dependencies=[Depends(require_admin)],
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
    total_members = len(members)
    member_ids = [str(m.user_id) for m in members]

    # All template version assignments for this project (project-wide org_id assignments)
    project_assignments = db.query(TemplateAssignment).filter(TemplateAssignment.org_id == project_id).all()

    # Resolve unique templates via template_version → template
    seen_template_ids: set[str] = set()
    templates_progress = []

    for assignment in project_assignments:
        if not assignment.template_version_id:
            continue
        version = db.query(TemplateVersion).filter(TemplateVersion.id == assignment.template_version_id).first()
        if not version:
            continue
        template = db.query(Template).filter(Template.id == version.template_id).first()
        if not template or template.id in seen_template_ids:
            continue
        seen_template_ids.add(template.id)

        # All assignment IDs for this template in this project
        t_assignment_ids = [
            a.id
            for a in db.query(TemplateAssignment)
            .filter(
                TemplateAssignment.org_id == project_id,
                TemplateAssignment.template_version_id == version.id,
            )
            .all()
        ]

        submitted_count = sum(
            1 for uid in member_ids
            if db.query(Submission).filter(
                Submission.assignment_id.in_(t_assignment_ids),
                Submission.submitted_by == uid,
            ).first()
        )

        templates_progress.append(
            {
                "template_id": template.id,
                "template_name": template.name,
                "total_members": total_members,
                "submitted_count": submitted_count,
                "all_submitted": submitted_count == total_members and total_members > 0,
            }
        )

    total_expected = total_members * len(templates_progress)
    total_submitted = sum(t["submitted_count"] for t in templates_progress)

    return {
        "total_members": total_members,
        "total_expected": total_expected,
        "total_submitted": total_submitted,
        "all_submitted": total_submitted == total_expected and total_expected > 0,
        "templates": templates_progress,
    }


def _has_ard_sheet(file_path: str) -> bool:
    """Return True if the xlsx at file_path contains a sheet whose name contains 'ard'."""
    try:
        wb = openpyxl.load_workbook(file_path, read_only=True)
        return any("ard" in name.lower() for name in wb.sheetnames)
    except Exception:
        return False


def _extract_ard_totals(file_path: str, org_name: str | None = None) -> dict | None:
    """Sum ARD data-row totals from a submission xlsx.

    Returns {'org_name': str, 'totals': {col_idx_0based: float}} for cols F-O (indices 5-14),
    or None if no ARD sheet is found.
    """
    try:
        wb = openpyxl.load_workbook(file_path, data_only=True)
    except Exception:
        return None

    ard_ws = next((wb[name] for name in wb.sheetnames if "ard" in name.lower()), None)
    if ard_ws is None:
        return None

    # Find header row: row in first 15 with most non-empty string cells
    header_row_num = 1
    best = 0
    for row in ard_ws.iter_rows(min_row=1, max_row=15):
        score = sum(1 for c in row if isinstance(c.value, str) and c.value.strip())
        if score > best:
            best = score
            header_row_num = row[0].row

    # Collect data rows: after header, col A has a numeric serial number
    data_rows: list[list] = []
    for row in ard_ws.iter_rows(min_row=header_row_num + 1):
        vals = [c.value for c in row]
        a_val = vals[0] if vals else None
        if isinstance(a_val, (int, float)):
            data_rows.append(vals)

    if not data_rows:
        return None

    def _to_num(v) -> float:
        if isinstance(v, (int, float)):
            return float(v)
        if isinstance(v, str):
            try:
                return float(v.replace(",", ""))
            except ValueError:
                return 0.0
        return 0.0

    totals: dict[int, float] = {}
    for col_idx in range(5, 15):  # F=5 … O=14 (0-based)
        totals[col_idx] = sum(_to_num(row[col_idx]) for row in data_rows if col_idx < len(row))

    if not org_name:
        for sname in wb.sheetnames:
            if "company" in sname.lower() or "infomation" in sname.lower() or "information" in sname.lower():
                ci_ws = wb[sname]
                for ci_row in ci_ws.iter_rows(max_row=20, values_only=True):
                    for val in ci_row:
                        if isinstance(val, str) and len(val.strip()) > 3:
                            org_name = val.strip()
                            break
                    if org_name:
                        break
                break

    return {"org_name": org_name or "Unknown", "totals": totals}


def _build_ard_output(master_template_path: str, ard_entries: list[dict]) -> bytes:
    """Copy master template xlsx, inject 'ARD' sheet with org totals, fix Sheet1 rate formulas.

    ARD sheet cols (mirror subcontractor template F-O):
      F(5)=Manhours  G(6)=SafeMH  H(7)=Fatalities  I(8)=LTI_incidents
      J(9)=LTI_MH   K(10)=TRI    L(11)=NearMiss   M(12)=SafetyObs
      N(13)=Walks    O(14)=Recognitions

    Sheet1 odd cols C,E,G,I,K,M,O = rate input cells (were #REF!); even cols = intact IFS scores.
    """
    import io as _io

    wb = openpyxl.load_workbook(master_template_path)

    # Build ARD sheet
    if "ARD" in wb.sheetnames:
        del wb["ARD"]
    ard_ws = wb.create_sheet("ARD")
    ard_ws.append([
        "Sr.No", "Org Name", "", "", "",
        "Total Manhours", "Safe Manhours", "Fatalities",
        "LTI Incidents", "LTI Manhours", "Total Recordable",
        "Near Miss", "Safety Observations", "Leadership Walks", "Recognitions",
    ])
    for i, entry in enumerate(ard_entries, start=1):
        row = [i, entry["org_name"], "", "", ""]
        for col_idx in range(5, 15):
            row.append(entry["totals"].get(col_idx, 0))
        ard_ws.append(row)
    grand = ["", "TOTAL", "", "", ""]
    for col_idx in range(5, 15):
        grand.append(sum(e["totals"].get(col_idx, 0) for e in ard_entries))
    ard_ws.append(grand)

    # Fix Sheet1 #REF! input cells with live ARD rate formulas
    sheet1 = wb["Sheet1"] if "Sheet1" in wb.sheetnames else None
    if sheet1 is not None:
        # (Sheet1 col, ARD incident col): rate = ARD!incident * 200000 / ARD!F (manhours)
        KPI_MAP = [("C", "H"), ("E", "I"), ("G", "K"), ("I", "L"), ("K", "M"), ("M", "N"), ("O", "O")]
        for org_idx, _entry in enumerate(ard_entries):
            s1_row = 6 + org_idx
            ard_row = 2 + org_idx
            for s1_col, ard_col in KPI_MAP:
                sheet1[f"{s1_col}{s1_row}"].value = f"=ARD!{ard_col}{ard_row}*200000/ARD!F{ard_row}"
        if ard_entries:
            sheet1["D2"] = ard_entries[0]["org_name"]
        sheet1["D3"] = datetime.utcnow().strftime("%Y-%m-%d")

    buf = _io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


@router.post(
    "/templates/{template_id}/consolidate-submissions",
    dependencies=[Depends(require_admin), Depends(verify_csrf)],
)
async def consolidate_submissions(
    template_id: str,
    body: dict,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Load project submission files, run AI schema unification, save ConsolidatedSheet."""
    from app.api.routes.ai import _ai_post

    settings = get_settings()
    project_id: str | None = body.get("project_id")
    submission_ids: list | None = body.get("submission_ids")
    report_name: str | None = body.get("name")
    report_period: str | None = body.get("period")

    if submission_ids:
        submissions = db.query(Submission).filter(Submission.id.in_(submission_ids)).all()
    elif project_id:
        from sqlalchemy import or_ as _or_
        # Include both legacy project-scoped (org_id=project_id) and new org-based assignments
        _member_ids = [m.user_id for m in db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()]
        _member_org_ids = list({str(p.org_id) for p in db.query(Profile).filter(Profile.id.in_(_member_ids)).all() if p.org_id})
        _org_filter = _or_(
            TemplateAssignment.org_id == project_id,
            *(TemplateAssignment.org_id == oid for oid in _member_org_ids),
        ) if _member_org_ids else (TemplateAssignment.org_id == project_id)
        aids = [a.id for a in db.query(TemplateAssignment).filter(_org_filter).all()]
        submissions = db.query(Submission).filter(Submission.assignment_id.in_(aids)).all() if aids else []
    else:
        raise HTTPException(status_code=400, detail="project_id or submission_ids required")

    if not submissions:
        raise HTTPException(status_code=400, detail="No submissions to consolidate")

    # ── ARD-mode detection ────────────────────────────────────────────────────
    # If every submission has an ARD sheet AND the project has a master template
    # with an uploaded xlsx, use ARD-based template consolidation (skip flat merge).
    _master_template_path: str | None = None
    if project_id:
        _proj = db.query(Project).filter(Project.id == project_id).first()
        if _proj and _proj.master_template_id:
            _master_ver = (
                db.query(TemplateVersion)
                .filter(TemplateVersion.template_id == _proj.master_template_id)
                .order_by(TemplateVersion.version_number.desc())
                .first()
            )
            if _master_ver and _master_ver.file_path and Path(_master_ver.file_path).exists():
                _master_template_path = _master_ver.file_path

    _submission_paths = [s.file_path for s in submissions if s.file_path and Path(s.file_path).exists()]

    if _master_template_path and _submission_paths and all(_has_ard_sheet(p) for p in _submission_paths):
        ard_entries = []
        for sub in submissions:
            if not sub.file_path or not Path(sub.file_path).exists():
                continue
            submitter = db.query(Profile).filter(Profile.id == sub.submitted_by).first()
            org_label = (submitter.org_name or submitter.display_name) if submitter else None
            entry = _extract_ard_totals(sub.file_path, org_name=org_label)
            if entry:
                ard_entries.append(entry)

        if ard_entries:
            output_bytes = _build_ard_output(_master_template_path, ard_entries)
            out_dir = Path(settings.upload_dir) / "consolidated"
            out_dir.mkdir(parents=True, exist_ok=True)
            sheet_id = str(_uuid.uuid4())
            out_path = out_dir / f"{sheet_id}.xlsx"
            out_path.write_bytes(output_bytes)
            auto_name = report_name or f"ARD Consolidation – {datetime.utcnow().strftime('%b %d, %Y')}"
            sheet = ConsolidatedSheet(
                id=sheet_id,
                template_id=template_id,
                project_id=project_id,
                name=auto_name,
                period=report_period,
                file_path=str(out_path),
                generated_by=str(user.id),
            )
            db.add(sheet)
            db.commit()
            return {"consolidated_sheet_id": sheet_id, "name": auto_name}
    # ── end ARD-mode block — fall through to flat consolidation ───────────────

    from app.api.routes.ai import _expand_merged

    # Sheets to always skip (utility / formula / metadata sheets)
    _SKIP_SHEETS = (
        "dropdown",
        "instruction",
        "readme",
        "legend",
        "lookup",
        "ref",
        "notes",
        "calculation sheet",
        "calculation",
        "formula",
        "sheet1",
        "company infomation",
        "company information",
        "company info",
        "wbs",
        "contracts",
        "construction cost",
        "milestones",
        "progress",
        "assets",
        "observations",
    )
    # Preferred DevCo input sheet names — checked in order; first match wins
    _PREFERRED = ("ard", "quality", "data", "input", "kpi", "hse", "safety", "metrics")

    def _best_header_row(rows: list) -> tuple:
        """Return the most likely column-name row in the first 30 rows.

        Scoring: most DISTINCT non-empty strings wins. Ties broken by shortest
        average string length — column names (e.g. '#', 'Level 1') are short,
        description/preamble rows use full sentences, so the column-names row
        wins even when both rows have the same number of distinct strings."""
        best_idx, best_row, best_count, best_avg = 0, rows[0] if rows else [], 0, float("inf")
        for idx, row in enumerate(rows[:30]):
            strings = [str(v).strip() for v in row if v is not None and isinstance(v, str) and str(v).strip()]
            distinct = len(set(strings))
            avg_len = sum(len(s) for s in strings) / len(strings) if strings else float("inf")
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
            data = [r for r in rows[hidx + 1 :] if any(c is not None and str(c).strip() for c in r)]
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
    failed_files: list[str] = []
    for sub in submissions:
        path = Path(sub.processed_file_path or sub.file_path)
        if not path.exists():
            import logging as _logging

            _logging.getLogger(__name__).warning(
                "consolidate_submissions: file missing for submission %s: %s", sub.id, path
            )
            failed_files.append(sub.file_name)
            continue
        try:
            wb = openpyxl.load_workbook(path, data_only=True)
            picked = _pick_sheet(wb)
            if not picked:
                import logging as _logging

                _logging.getLogger(__name__).warning(
                    "consolidate_submissions: no usable sheet in submission %s (%s)", sub.id, sub.file_name
                )
                failed_files.append(sub.file_name)
                continue
            _, rows, header_idx, header_row, _ = picked

            # Truncate verbose header strings — KPI templates use full sentences as column names
            headers = [str(h).strip()[:80] if h is not None else "" for h in header_row]

            def _nonempty(v) -> bool:
                return v is not None and str(v).strip() != ""

            def _coerce(v):
                """Preserve native numeric types; only stringify text."""
                if v is None:
                    return None
                if isinstance(v, (int, float)):
                    return v
                s = str(v).strip()
                if s == "":
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
                for r in rows[header_idx + 1 :]
                if (sum(1 for c in r if _nonempty(c)) >= 3 and len({str(c) for c in r if _nonempty(c)}) > 1)
            ]
            if not data_rows:
                continue

            file_schemas.append({"name": sub.file_name, "headers": headers, "sample_rows": data_rows[:5]})
            all_file_data.append({"name": sub.file_name, "headers": headers, "all_rows": data_rows})
        except Exception as exc:
            import logging as _logging

            _logging.getLogger(__name__).warning(
                "consolidate_submissions: failed to parse %s (sub %s): %s", sub.file_name, sub.id, exc
            )
            failed_files.append(sub.file_name)
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
        '- Always include "Source File" as the first unified header.\n'
        "- Merge columns that represent the same concept under one standard name.\n"
        "- Include every column that appears in at least one file.\n"
        "- column_map must cover every source column in that file."
    )
    ai_data = await _ai_post(
        {
            "model": "anthropic/claude-sonnet-4-5",
            "max_tokens": 8192,
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": json.dumps(
                        [
                            {"name": f["name"], "headers": f["headers"], "sample_rows": f["sample_rows"][:3]}
                            for f in file_schemas
                        ]
                    ),
                },
            ],
        }
    )

    raw_ai = ai_data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
    raw_ai = raw_ai.strip()
    if raw_ai.startswith("```"):
        raw_ai = raw_ai.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    try:
        schema = json.loads(raw_ai)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail=f"AI returned invalid schema: {exc}") from exc

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

    auto_name = report_name or f"Consolidation – {datetime.utcnow().strftime('%b %d, %Y')}"
    sheet = ConsolidatedSheet(
        id=sheet_id,
        template_id=template_id,
        project_id=project_id,
        name=auto_name,
        period=report_period,
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
        "name": auto_name,
        "period": report_period,
        "failed_files": failed_files,
    }


# ── Assignment Lock / Unlock ─────────────────────────────────────────────────


class AssignmentLockResponse(BaseModel):
    id: str
    status: str
    locked_at: datetime | None = None
    locked_by: str | None = None

    model_config = {"from_attributes": True}


# ── Master report management ──────────────────────────────────────────────────


class ConsolidatedSheetResponse(BaseModel):
    id: str
    template_id: str
    project_id: str | None
    name: str | None
    period: str | None
    generated_by: str | None
    generated_at: datetime

    model_config = {"from_attributes": True}


@router.delete("/assignments/{assignment_id}", status_code=204, dependencies=[Depends(require_admin), Depends(verify_csrf)])
def delete_assignment(assignment_id: str, db: Session = Depends(get_db)):
    """Remove a template assignment (and its submissions)."""
    a = db.query(TemplateAssignment).filter(TemplateAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.query(Submission).filter(Submission.assignment_id == assignment_id).delete(synchronize_session=False)
    db.delete(a)
    db.commit()


@router.post("/assignments/{assignment_id}/lock", response_model=AssignmentLockResponse)
def lock_assignment(
    assignment_id: str,
    user: Profile = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Lock a submission — no further uploads accepted from the DevCo."""
    a = db.query(TemplateAssignment).filter(TemplateAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if a.status == "locked":
        raise HTTPException(status_code=409, detail="Assignment already locked")
    a.status = "locked"
    a.locked_at = datetime.now(timezone.utc)
    a.locked_by = str(user.id)
    db.commit()
    db.refresh(a)
    return a


@router.post("/assignments/{assignment_id}/unlock", response_model=AssignmentLockResponse)
def unlock_assignment(
    assignment_id: str,
    user: Profile = Depends(require_admin),
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
    user: Profile = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return db.query(TemplateFormula).filter(TemplateFormula.template_version_id == version_id).all()


@router.post(
    "/template-versions/{version_id}/formulas",
    response_model=TemplateFormulaResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_formula(
    version_id: str,
    body: TemplateFormulaCreate,
    user: Profile = Depends(require_admin),
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
    user: Profile = Depends(require_admin),
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
    user: Profile = Depends(require_admin),
    db: Session = Depends(get_db),
):
    f = db.query(TemplateFormula).filter(TemplateFormula.id == formula_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Formula not found")
    db.delete(f)
    db.commit()


# ── Master report management ─────────────────────────────────────────────────


class RenameReportRequest(BaseModel):
    name: str


@router.get(
    "/projects/{project_id}/master-reports",
    response_model=list[ConsolidatedSheetResponse],
    dependencies=[Depends(require_admin)],
)
def list_master_reports(project_id: str, db: Session = Depends(get_db)):
    """List all consolidated master reports for a project, newest first."""
    return (
        db.query(ConsolidatedSheet)
        .filter(ConsolidatedSheet.project_id == project_id)
        .order_by(ConsolidatedSheet.generated_at.desc())
        .all()
    )


@router.patch(
    "/consolidated-sheets/{sheet_id}/rename",
    response_model=ConsolidatedSheetResponse,
    dependencies=[Depends(require_admin), Depends(verify_csrf)],
)
def rename_master_report(
    sheet_id: str,
    body: RenameReportRequest,
    db: Session = Depends(get_db),
):
    """Rename a consolidated master report."""
    sheet = db.query(ConsolidatedSheet).filter(ConsolidatedSheet.id == sheet_id).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Report not found")
    sheet.name = body.name
    db.commit()
    db.refresh(sheet)
    return sheet


@router.delete(
    "/consolidated-sheets/{sheet_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin), Depends(verify_csrf)],
)
def delete_master_report(sheet_id: str, db: Session = Depends(get_db)):
    """Delete a consolidated master report record and its file from disk."""
    sheet = db.query(ConsolidatedSheet).filter(ConsolidatedSheet.id == sheet_id).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Report not found")
    try:
        Path(sheet.file_path).unlink(missing_ok=True)
    except Exception:
        pass
    db.delete(sheet)
    db.commit()


@router.get(
    "/consolidated-sheets/{sheet_id}/download",
    dependencies=[Depends(require_admin)],
)
def download_master_report(sheet_id: str, db: Session = Depends(get_db)):
    """Download the xlsx file for a consolidated master report."""
    sheet = db.query(ConsolidatedSheet).filter(ConsolidatedSheet.id == sheet_id).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Report not found")
    path = Path(sheet.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    filename = f"{sheet.name or sheet_id}.xlsx".replace("/", "-")
    return FileResponse(
        str(path),
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
