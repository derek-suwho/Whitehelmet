"""Auth request/response schemas."""

from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    external_id: str
    email: str
    display_name: str

    model_config = {"from_attributes": True}
