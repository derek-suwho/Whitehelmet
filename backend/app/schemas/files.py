"""File upload/download response schemas."""

from datetime import datetime

from pydantic import BaseModel


class FileResponse(BaseModel):
    id: int
    original_name: str
    size_bytes: int
    sha256: str
    created_at: datetime

    model_config = {"from_attributes": True}


class FileListResponse(BaseModel):
    files: list[FileResponse]
    total: int
