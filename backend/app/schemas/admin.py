"""Admin request/response schemas."""

from __future__ import annotations

from pydantic import BaseModel


class UserProjectEntry(BaseModel):
    project_id: str
    project_name: str
    membership_id: str
    participant_role: str | None = None


class UserWithOrgResponse(BaseModel):
    id: str
    display_name: str
    email: str | None = None
    role: str | None
    org_id: str | None
    org_name: str | None = None
    project_name: str | None = None
    participant_role: str | None = None
    projects: list[UserProjectEntry] = []

    model_config = {"from_attributes": True}


class UpdateRoleRequest(BaseModel):
    role: str  # super_admin | coe_admin | participant
    participant_role: str | None = None  # focal | member | viewer (only for participant)


class UpdateOrgRequest(BaseModel):
    org_name: str


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
