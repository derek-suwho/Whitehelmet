"""Pydantic schemas for TemplateFormula CRUD."""

from __future__ import annotations
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel


class TemplateFormulaCreate(BaseModel):
    name: str
    target_column: str                    # e.g. "E"
    formula_type: str = "column"          # "column" | "single_cell"
    expression: str                       # e.g. "=O{row}/N{row}"
    weight: Optional[float] = None
    benchmark: Optional[float] = None
    scoring_rules: Optional[Any] = None   # list of {min, max, score} dicts


class TemplateFormulaUpdate(BaseModel):
    name: Optional[str] = None
    target_column: Optional[str] = None
    formula_type: Optional[str] = None
    expression: Optional[str] = None
    weight: Optional[float] = None
    benchmark: Optional[float] = None
    scoring_rules: Optional[Any] = None


class TemplateFormulaResponse(BaseModel):
    id: str
    template_version_id: str
    name: str
    target_column: str
    formula_type: str
    expression: str
    weight: Optional[float]
    benchmark: Optional[float]
    scoring_rules: Optional[Any]
    created_by: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
