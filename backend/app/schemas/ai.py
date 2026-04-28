"""AI proxy request/response schemas."""

from __future__ import annotations
from typing import Optional

from pydantic import BaseModel


class ChatRequest(BaseModel):
    messages: list[dict]
    model: str = "anthropic/claude-opus-4-5"
    max_tokens: int = 4096
    stream: bool = True


class FileSchema(BaseModel):
    name: str
    headers: list[str]
    sample_rows: list[list]  # first few rows for AI schema detection only

class ColumnMapping(BaseModel):
    file: str
    column_map: dict[str, str]  # source_col → unified_col

class ConsolidateRequest(BaseModel):
    files_schema: list[FileSchema]
    model: str = "anthropic/claude-opus-4-5"

class ConsolidateResponse(BaseModel):
    unified_headers: list[str]
    mappings: list[ColumnMapping]


class CommandRequest(BaseModel):
    message: str
    headers: list[str]
    snapshot: Optional[str] = None
    model: str = "anthropic/claude-opus-4-5"


class CommandResponse(BaseModel):
    op: Optional[str]
    params: dict = {}
