"""File upload routes — validated xlsx upload with server-side storage."""

import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import get_current_user, verify_csrf
from app.core.security import hash_file
from app.db.session import get_db
from app.models.uploaded_file import UploadedFile
from app.models.user import User

router = APIRouter(
    prefix="/api/files",
    tags=["files"],
    dependencies=[Depends(get_current_user), Depends(verify_csrf)],
)

ALLOWED_MIME_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
}
ALLOWED_EXTENSIONS = {".xlsx", ".xls"}


@router.post("/upload", status_code=status.HTTP_201_CREATED)
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

    return {
        "id": uploaded.id,
        "original_name": uploaded.original_name,
        "size_bytes": uploaded.size_bytes,
        "sha256": uploaded.sha256,
    }
