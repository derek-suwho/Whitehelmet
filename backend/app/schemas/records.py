"""Record request/response schemas."""

from datetime import datetime

from pydantic import BaseModel


class RecordCreate(BaseModel):
    name: str
    source_count: int = 0
    row_count: int = 0
    col_count: int = 0


class RecordResponse(BaseModel):
    id: int
    name: str
    source_count: int
    row_count: int
    col_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RecordList(BaseModel):
    records: list[RecordResponse]
    total: int
