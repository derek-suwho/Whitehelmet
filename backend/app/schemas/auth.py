"""Auth response schemas."""

from __future__ import annotations

from pydantic import BaseModel


class UserResponse(BaseModel):
    id: str  # UUID string
    email: str | None = None
    role: str | None = None
    org_id: str | None = None
    display_name: str

    model_config = {"from_attributes": True}
