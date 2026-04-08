"""AI proxy request/response schemas."""

from pydantic import BaseModel


class ChatRequest(BaseModel):
    messages: list[dict]
    model: str = "anthropic/claude-sonnet-4-20250514"
    max_tokens: int = 4096
    stream: bool = True


class ConsolidateRequest(BaseModel):
    files_data: list[dict]  # [{name, headers, rows}]
    model: str = "anthropic/claude-sonnet-4-20250514"


class CommandRequest(BaseModel):
    user_text: str
    column_headers: list[str]
    model: str = "claude-sonnet-4-20250514"


class CommandResponse(BaseModel):
    op: str | None
    raw: dict
