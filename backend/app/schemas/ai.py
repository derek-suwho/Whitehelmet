"""AI proxy request/response schemas."""

from __future__ import annotations
from typing import Optional

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
    snapshot: Optional[str] = None
    model: str = "anthropic/claude-opus-4-5"


class CommandResponse(BaseModel):
    op: Optional[str]
    params: dict = {}
