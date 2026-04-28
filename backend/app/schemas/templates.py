"""Template request/response schemas."""

from __future__ import annotations
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None


class TemplateResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    created_by: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TemplateVersionCreate(BaseModel):
    schema_json: Any


class TemplateVersionResponse(BaseModel):
    id: str
    template_id: str
    version_number: int
    schema_json: Any
    created_by: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class ConsolidatedSheetResponse(BaseModel):
    id: str
    template_id: str
    file_path: str
    generated_by: Optional[str]
    generated_at: datetime

    model_config = {"from_attributes": True}
