"""Formula library request/response schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class FormulaCreate(BaseModel):
    name: str
    expression: str
    description: str | None = None
    nl_prompt: str | None = None
    formula_type: str | None = None


class FormulaResponse(BaseModel):
    id: str
    name: str
    expression: str
    description: str | None
    nl_prompt: str | None
    formula_type: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FormulaListResponse(BaseModel):
    formulas: list[FormulaResponse]
    total: int
