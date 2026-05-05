"""Template request/response schemas."""

from __future__ import annotations
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    template_type: str = "subcontractor"


class TemplateResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    created_by: Optional[str]
    status: str
    template_type: str = "subcontractor"
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
    created_by: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class ConsolidatedSheetResponse(BaseModel):
    id: str
    template_id: str
    file_path: str
    generated_by: Optional[str]
    generated_at: datetime

    model_config = {"from_attributes": True}
