"""Auth request/response schemas."""

from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str


class UserResponse(BaseModel):
    id: int
    external_id: str
    email: str
    display_name: str
    role: Optional[str] = None
    org_id: Optional[str] = None

    model_config = {"from_attributes": True}
