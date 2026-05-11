"""Pydantic schemas for TemplateFormula CRUD."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class TemplateFormulaCreate(BaseModel):
    name: str
    target_column: str  # e.g. "E"
    formula_type: str = "column"  # "column" | "single_cell"
    expression: str  # e.g. "=O{row}/N{row}"
    weight: float | None = None
    benchmark: float | None = None
    scoring_rules: Any | None = None  # list of {min, max, score} dicts
    target_row: int | None = None
    target_sheet: str | None = None


class TemplateFormulaUpdate(BaseModel):
    name: str | None = None
    target_column: str | None = None
    formula_type: str | None = None
    expression: str | None = None
    weight: float | None = None
    benchmark: float | None = None
    scoring_rules: Any | None = None
    target_row: int | None = None
    target_sheet: str | None = None


class TemplateFormulaResponse(BaseModel):
    id: str
    template_version_id: str
    name: str
    target_column: str
    formula_type: str
    expression: str
    weight: float | None
    benchmark: float | None
    scoring_rules: Any | None
    created_by: str | None
    created_at: datetime
    target_row: int | None = None
    target_sheet: str | None = None

    model_config = {"from_attributes": True}
