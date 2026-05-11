"""Admin request/response schemas."""

from __future__ import annotations

from pydantic import BaseModel


class UserWithOrgResponse(BaseModel):
    id: str
    display_name: str
    email: str | None = None
    role: str | None
    org_id: str | None
    project_name: str | None = None

    model_config = {"from_attributes": True}


class UpdateRoleRequest(BaseModel):
    role: str  # super_admin | coe_admin | participant


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
