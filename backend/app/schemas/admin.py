"""Admin request/response schemas."""

from __future__ import annotations
from typing import Optional

from pydantic import BaseModel


class UserWithOrgResponse(BaseModel):
    id: int
    external_id: str
    email: str
    display_name: str
    role: Optional[str]
    org_id: Optional[str]

    model_config = {"from_attributes": True}


class UpdateRoleRequest(BaseModel):
    role: str


class AssignmentCreate(BaseModel):
    template_version_id: Optional[str] = None
    org_ids: list[str]
    org_id: Optional[str] = None
    deadline: Optional[str] = None
    instructions: Optional[str] = None
    submission_type: str = "template"


class AssignmentResponse(BaseModel):
    id: str
    org_id: str
    submission_type: str
    status: str
    upload_token: Optional[str]

    model_config = {"from_attributes": True}
