"""Project request/response schemas."""

from __future__ import annotations
from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AddMemberRequest(BaseModel):
    user_id: int


class AssignTemplateRequest(BaseModel):
    template_version_id: str
    deadline: Optional[str] = None
    member_user_ids: Optional[list[int]] = None  # if set, create per-member assignments


class ProjectDetailResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    status: str
    created_at: datetime
    members: list[dict[str, Any]]
    template_assignments: list[dict[str, Any]]
