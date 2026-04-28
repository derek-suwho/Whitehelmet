"""Template routes — CRUD, versioning, status management."""
import uuid, json
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse as FastAPIFileResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, verify_csrf
from app.db.session import get_db
from app.models.template import Template
from app.models.template_version import TemplateVersion
from app.models.consolidated_sheet import ConsolidatedSheet
from app.models.user import User
from app.schemas.templates import (
    TemplateCreate, TemplateResponse,
    TemplateVersionCreate, TemplateVersionResponse,
    ConsolidatedSheetResponse,
)

router = APIRouter(
    prefix="/api/templates",
    tags=["templates"],
    dependencies=[Depends(get_current_user)],
)

@router.get("", response_model=list[TemplateResponse])
def list_templates(db: Session = Depends(get_db)):
    return db.query(Template).order_by(Template.updated_at.desc()).all()

@router.post("", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(verify_csrf)])
def create_template(body: TemplateCreate, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    tmpl = Template(
        id=str(uuid.uuid4()),
        name=body.name,
        description=body.description,
        created_by=str(user.id),
        status="draft",
    )
    db.add(tmpl)
    db.commit()
    db.refresh(tmpl)
    return tmpl

@router.get("/{template_id}", response_model=TemplateResponse)
def get_template(template_id: str, db: Session = Depends(get_db)):
    tmpl = db.query(Template).filter(Template.id == template_id).first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return tmpl

@router.patch("/{template_id}/status", response_model=TemplateResponse,
              dependencies=[Depends(verify_csrf)])
def update_status(template_id: str, body: dict, db: Session = Depends(get_db)):
    tmpl = db.query(Template).filter(Template.id == template_id).first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    new_status = body.get("status")
    if new_status not in ("draft", "active", "deprecated"):
        raise HTTPException(status_code=422, detail="Invalid status")
    tmpl.status = new_status
    db.commit()
    db.refresh(tmpl)
    return tmpl

@router.get("/{template_id}/versions", response_model=list[TemplateVersionResponse])
def list_versions(template_id: str, db: Session = Depends(get_db)):
    return (
        db.query(TemplateVersion)
        .filter(TemplateVersion.template_id == template_id)
        .order_by(TemplateVersion.version_number.desc())
        .all()
    )

@router.post("/{template_id}/versions", response_model=TemplateVersionResponse,
             status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_csrf)])
def save_version(template_id: str, body: TemplateVersionCreate,
                 user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tmpl = db.query(Template).filter(Template.id == template_id).first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")

    last = (
        db.query(TemplateVersion)
        .filter(TemplateVersion.template_id == template_id)
        .order_by(TemplateVersion.version_number.desc())
        .first()
    )
    next_version = (last.version_number if last else 0) + 1

    ver = TemplateVersion(
        id=str(uuid.uuid4()),
        template_id=template_id,
        version_number=next_version,
        schema_json=json.dumps(body.schema_json),
        created_by=str(user.id),
    )
    db.add(ver)
    db.commit()
    db.refresh(ver)

    # Return schema_json as parsed object
    ver.schema_json = body.schema_json
    return ver

@router.get("/consolidations/{sheet_id}/download")
def download_consolidated(sheet_id: str, db: Session = Depends(get_db)):
    sheet = db.query(ConsolidatedSheet).filter(ConsolidatedSheet.id == sheet_id).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Consolidated sheet not found")
    path = Path(sheet.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FastAPIFileResponse(
        path=str(path),
        filename=f"consolidated_{sheet_id}.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

@router.get("/{template_id}/consolidations", response_model=list[ConsolidatedSheetResponse])
def list_consolidations(template_id: str, db: Session = Depends(get_db)):
    return (
        db.query(ConsolidatedSheet)
        .filter(ConsolidatedSheet.template_id == template_id)
        .order_by(ConsolidatedSheet.generated_at.desc())
        .all()
    )
