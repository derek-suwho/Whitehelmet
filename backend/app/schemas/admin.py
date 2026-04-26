from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UserWithOrgResponse(BaseModel):
    id: int
    email: str
    display_name: str
    role: str
    org_id: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class UpdateRoleRequest(BaseModel):
    role: str
