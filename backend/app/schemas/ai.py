"""AI proxy request/response schemas."""

from pydantic import BaseModel


class ChatRequest(BaseModel):
    messages: list[dict]
    model: str = "anthropic/claude-opus-4-5"
    max_tokens: int = 4096
    stream: bool = True


class ConsolidateRequest(BaseModel):
    files_data: list[dict]  # [{name, headers, rows}]
    model: str = "anthropic/claude-opus-4-5"


class CommandRequest(BaseModel):
    message: str
    headers: list[str]
    snapshot: str | None = None
    model: str = "anthropic/claude-opus-4-5"


class CommandResponse(BaseModel):
    op: str | None
    params: dict = {}
