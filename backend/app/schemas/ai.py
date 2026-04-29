"""AI proxy request/response schemas."""

from __future__ import annotations
from typing import Optional

from pydantic import BaseModel, field_validator


class ChatRequest(BaseModel):
    messages: list[dict]
    model: str = "anthropic/claude-opus-4-5"
    max_tokens: int = 4096
    stream: bool = True


class FileSchema(BaseModel):
    name: str
    headers: list[str | None]
    sample_rows: list[list]  # first few rows for AI schema detection only

    @field_validator('headers', mode='before')
    @classmethod
    def coerce_headers(cls, v: list) -> list:
        return ['' if h is None else str(h) for h in v]

class ColumnMapping(BaseModel):
    file: str
    column_map: dict[str, str]  # source_col → unified_col

class ConsolidateRequest(BaseModel):
    files_schema: list[FileSchema]
    model: str = "anthropic/claude-opus-4-5"

class ConsolidateResponse(BaseModel):
    unified_headers: list[str]
    mappings: list[ColumnMapping]


class AgentRequest(BaseModel):
    message: str
    headers: list[str]
    data: list[list] = []
    model: str = "anthropic/claude-sonnet-4-6"


class CommandRequest(BaseModel):
    message: str
    headers: list[str]
    snapshot: Optional[str] = None
    model: str = "anthropic/claude-opus-4-5"


class CommandResponse(BaseModel):
    op: Optional[str]
    params: dict = {}
