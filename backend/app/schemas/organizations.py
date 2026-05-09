"""Organization request/response schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class OrganizationCreate(BaseModel):
    name: str
    type: str
    parent_org_id: str | None = None


class OrganizationResponse(BaseModel):
    id: str
    name: str
    type: str
    parent_org_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
