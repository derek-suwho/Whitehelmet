"""Pydantic schemas for the subcontractor portal and PM progress tracking."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class AssignmentForSubcontractor(BaseModel):
    id: str
    template_version_id: str | None
    deadline: datetime | None
    instructions: str | None
    status: str
    assigned_at: datetime
    template_name: str | None
    has_submission: bool


class SubmissionResponse(BaseModel):
    id: str
    assignment_id: str
    org_id: str
    file_name: str
    status: str
    submitted_at: datetime
    submitted_by: str | None
    processed_file_path: str | None = None

    model_config = {"from_attributes": True}


class OrgSubmissionStatus(BaseModel):
    org_id: str
    org_name: str
    assignment_id: str | None
    assignment_status: str
    submission_id: str | None
    submitted_at: datetime | None
    file_name: str | None


class ConsolidationProgressResponse(BaseModel):
    template_id: str
    template_version_id: str | None
    total_orgs: int
    submitted_count: int
    all_submitted: bool
    orgs: list[OrgSubmissionStatus]
