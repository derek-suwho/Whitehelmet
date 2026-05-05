"""Pydantic schemas for the subcontractor portal and PM progress tracking."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AssignmentForSubcontractor(BaseModel):
    id: str
    template_version_id: Optional[str]
    deadline: Optional[datetime]
    instructions: Optional[str]
    status: str
    assigned_at: datetime
    template_name: Optional[str]
    has_submission: bool


class SubmissionResponse(BaseModel):
    id: str
    assignment_id: str
    org_id: str
    file_name: str
    status: str
    submitted_at: datetime
    submitted_by: Optional[str]
    processed_file_path: Optional[str] = None

    model_config = {"from_attributes": True}


class OrgSubmissionStatus(BaseModel):
    org_id: str
    org_name: str
    assignment_id: Optional[str]
    assignment_status: str
    submission_id: Optional[str]
    submitted_at: Optional[datetime]
    file_name: Optional[str]


class ConsolidationProgressResponse(BaseModel):
    template_id: str
    template_version_id: Optional[str]
    total_orgs: int
    submitted_count: int
    all_submitted: bool
    orgs: list[OrgSubmissionStatus]
