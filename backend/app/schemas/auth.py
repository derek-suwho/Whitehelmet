"""Auth request/response schemas."""

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

    model_config = {"from_attributes": True}
