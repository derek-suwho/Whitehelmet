"""Template request/response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class TemplateCreate(BaseModel):
    name: str
    description: str | None = None
    template_type: str = "subcontractor"
    project_id: str | None = None


class TemplateResponse(BaseModel):
    id: str
    name: str
    description: str | None
    created_by: str | None
    status: str
    template_type: str = "subcontractor"
    project_id: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TemplateVersionCreate(BaseModel):
    schema_data: Any = Field(validation_alias="schema_json", serialization_alias="schema_json")

    model_config = {"populate_by_name": True}


class TemplateVersionResponse(BaseModel):
    id: str
    template_id: str
    version_number: int
    schema_data: Any = Field(validation_alias="schema_json", serialization_alias="schema_json")
    created_by: str | None
    created_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class ConsolidatedSheetResponse(BaseModel):
    id: str
    template_id: str
    file_path: str
    generated_by: str | None
    generated_at: datetime

    model_config = {"from_attributes": True}
