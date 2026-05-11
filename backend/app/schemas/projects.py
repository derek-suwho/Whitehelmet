"""Project request/response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str | None
    status: str
    master_template_id: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AddMemberRequest(BaseModel):
    user_id: str
    participant_role: str = "focal"  # focal | member | viewer


class AssignTemplateRequest(BaseModel):
    template_version_id: str
    deadline: str | None = None
    member_user_ids: list[str] | None = None  # if set, create per-member assignments


class AssignMasterTemplateRequest(BaseModel):
    master_template_id: str | None = None


class ProjectDetailResponse(BaseModel):
    id: str
    name: str
    description: str | None
    status: str
    master_template_id: str | None = None
    master_template_name: str | None = None
    created_at: datetime
    members: list[dict[str, Any]]
    template_assignments: list[dict[str, Any]]
