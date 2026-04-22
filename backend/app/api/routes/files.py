"""File routes — upload, list, download, delete (user-scoped)."""

import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse as FastAPIFileResponse
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import get_current_user, verify_csrf
from app.core.security import hash_file
from app.db.session import get_db
from app.models.uploaded_file import UploadedFile
from app.models.user import User
from app.schemas.files import FileResponse, FileListResponse

router = APIRouter(
    prefix="/api/files",
    tags=["files"],
    dependencies=[Depends(get_current_user)],
)

ALLOWED_MIME_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
}
ALLOWED_EXTENSIONS = {".xlsx", ".xls"}


@router.get("", response_model=FileListResponse)
async def list_files(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all files for the authenticated user."""
    files = (
        db.query(UploadedFile)
        .filter(UploadedFile.user_id == user.id)
        .order_by(UploadedFile.created_at.desc())
        .all()
    )
    return FileListResponse(
        files=[FileResponse.model_validate(f) for f in files],
        total=len(files),
    )


@router.get("/{file_id}", response_model=FileResponse)
async def get_file(
    file_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get file metadata (user-scoped)."""
    f = (
        db.query(UploadedFile)
        .filter(UploadedFile.id == file_id, UploadedFile.user_id == user.id)
        .first()
    )
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    return f


@router.get("/{file_id}/download")
async def download_file(
    file_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download file content (user-scoped)."""
    f = (
        db.query(UploadedFile)
        .filter(UploadedFile.id == file_id, UploadedFile.user_id == user.id)
        .first()
    )
    if not f:
        raise HTTPException(status_code=404, detail="File not found")

    stored = Path(f.stored_path)
    if not stored.exists():
        raise HTTPException(status_code=404, detail="File data missing from storage")

    return FastAPIFileResponse(
        path=str(stored),
        filename=f.original_name,
        media_type=f.mime_type or "application/octet-stream",
    )


@router.post("/upload", status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_csrf)])
async def upload_file(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload and validate an xlsx file."""
    settings = get_settings()

    # Validate extension
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only .xlsx/.xls files allowed, got '{ext}'",
        )

    # Read and validate size
    content = await file.read()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {settings.max_upload_size_mb}MB limit",
        )

    # Validate xlsx magic bytes (PK zip header)
    if content[:4] != b"PK\x03\x04":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File does not appear to be a valid xlsx",
        )

    # Store file outside webroot
    sha = hash_file(content)
    user_dir = Path(settings.upload_dir) / str(user.id)
    user_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{sha}{ext}"
    stored_path = user_dir / stored_name

    stored_path.write_bytes(content)

    # Save metadata
    uploaded = UploadedFile(
        user_id=user.id,
        original_name=file.filename or "unknown.xlsx",
        stored_path=str(stored_path),
        mime_type=file.content_type or "application/octet-stream",
        size_bytes=len(content),
        sha256=sha,
    )
    db.add(uploaded)
    db.commit()
    db.refresh(uploaded)

    return FileResponse.model_validate(uploaded)


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(verify_csrf)])
async def delete_file(
    file_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a file (user-scoped). Removes both DB record and stored file."""
    f = (
        db.query(UploadedFile)
        .filter(UploadedFile.id == file_id, UploadedFile.user_id == user.id)
        .first()
    )
    if not f:
        raise HTTPException(status_code=404, detail="File not found")

    # Remove stored file
    stored = Path(f.stored_path)
    if stored.exists():
        stored.unlink()

    db.delete(f)
    db.commit()
