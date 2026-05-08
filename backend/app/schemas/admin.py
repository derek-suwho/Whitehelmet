"""Admin request/response schemas."""

from __future__ import annotations

from pydantic import BaseModel


class UserWithOrgResponse(BaseModel):
    id: str
    display_name: str
    role: str | None
    org_id: str | None

    model_config = {"from_attributes": True}


class UpdateRoleRequest(BaseModel):
    role: str


class AssignmentCreate(BaseModel):
    template_version_id: str | None = None
    org_ids: list[str]
    org_id: str | None = None
    deadline: str | None = None
    instructions: str | None = None
    submission_type: str = "template"


class AssignmentResponse(BaseModel):
    id: str
    org_id: str
    submission_type: str
    status: str
    upload_token: str | None

    model_config = {"from_attributes": True}
