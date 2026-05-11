"""Formula library request/response schemas."""

from __future__ import annotations

import math
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class FormulaCreate(BaseModel):
    name: str
    expression: str
    parameters: list[str] | None = None  # named param identifiers used in the expression
    description: str | None = None
    nl_prompt: str | None = None
    formula_type: str | None = None


class FormulaResponse(BaseModel):
    id: str
    name: str
    expression: str
    parameters: list[str] | None = None
    description: str | None
    nl_prompt: str | None
    formula_type: str | None
    is_library_item: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class FormulaListResponse(BaseModel):
    formulas: list[FormulaResponse]
    total: int


class FormulaEvaluateRequest(BaseModel):
    formula_id: str
    column_map: dict[str, str]   # param_name -> actual column header in the sheet
    output_name: str             # name for the new output column
    rows: list[dict[str, Any]]   # each row as {column_header: value}


class FormulaEvaluateResponse(BaseModel):
    column_name: str
    values: list[float | None]


# ── Safe expression evaluator ────────────────────────────────────────────────

_SAFE_NAMES: dict[str, Any] = {
    "abs": abs, "round": round, "min": min, "max": max, "sum": sum,
    "sqrt": math.sqrt, "pow": math.pow, "log": math.log,
    "log10": math.log10, "exp": math.exp,
    "ceil": math.ceil, "floor": math.floor,
    "pi": math.pi, "e": math.e,
}


def safe_eval_expression(expression: str, variables: dict[str, float]) -> float | None:
    """Evaluate a math expression with named variables. Raises ValueError on unsafe input."""
    if "__" in expression or "import" in expression or "exec" in expression:
        raise ValueError("Unsafe expression")
    ns: dict[str, Any] = {"__builtins__": {}, **_SAFE_NAMES, **variables}
    result = eval(expression, ns)  # noqa: S307
    return float(result) if result is not None else None
