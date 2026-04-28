"""Formula library request/response schemas."""

from __future__ import annotations
from typing import Optional
from datetime import datetime

from pydantic import BaseModel


class FormulaCreate(BaseModel):
    name: str
    expression: str
    description: Optional[str] = None
    nl_prompt: Optional[str] = None
    formula_type: Optional[str] = None


class FormulaResponse(BaseModel):
    id: int
    name: str
    expression: str
    description: Optional[str]
    nl_prompt: Optional[str]
    formula_type: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class FormulaListResponse(BaseModel):
    formulas: list[FormulaResponse]
    total: int
