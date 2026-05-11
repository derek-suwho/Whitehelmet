"""Formula library CRUD routes."""

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, verify_csrf
from app.core.rbac import require_admin
from app.db.session import get_db
from app.models.formula import Formula
from app.models.profile import Profile
from app.models.template_formula import TemplateFormula
from app.models.template_version import TemplateVersion
from app.schemas.formula import (
    FormulaCreate,
    FormulaEvaluateRequest,
    FormulaEvaluateResponse,
    FormulaListResponse,
    FormulaResponse,
    safe_eval_expression,
)
from app.schemas.template_formula import TemplateFormulaCreate

router = APIRouter(
    prefix="/api/formulas",
    tags=["formulas"],
    dependencies=[Depends(get_current_user), Depends(verify_csrf)],
)


def _formula_to_response(formula: Formula) -> dict:
    params = None
    if formula.parameters:
        try:
            params = json.loads(formula.parameters)
        except Exception:
            params = None
    return {
        "id": formula.id,
        "name": formula.name,
        "expression": formula.expression,
        "parameters": params,
        "description": formula.description,
        "nl_prompt": formula.nl_prompt,
        "formula_type": formula.formula_type,
        "is_library_item": formula.is_library_item,
        "created_at": formula.created_at,
    }


@router.post("/bulk-save")
def bulk_save_template_formulas(
    template_version_id: str,
    formulas: list[TemplateFormulaCreate],
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    """Atomically replace all formulas for a template version."""
    tv = db.query(TemplateVersion).filter(TemplateVersion.id == template_version_id).first()
    if not tv:
        raise HTTPException(404, "Template version not found")

    db.query(TemplateFormula).filter(
        TemplateFormula.template_version_id == template_version_id
    ).delete()

    created = []
    for f in formulas:
        tf = TemplateFormula(
            id=str(uuid.uuid4()),
            template_version_id=template_version_id,
            name=f.name,
            target_column=f.target_column,
            formula_type=f.formula_type,
            expression=f.expression,
            target_row=f.target_row,
            weight=f.weight,
            scoring_rules=f.scoring_rules,
            created_by=user.id,
        )
        db.add(tf)
        created.append(tf.id)
    db.commit()
    return {"replaced": len(created), "ids": created}


@router.get("/library", response_model=list[FormulaResponse])
def list_library_formulas(db: Session = Depends(get_db)):
    """List all formula presets (library items)."""
    rows = db.query(Formula).filter(Formula.is_library_item == True).order_by(Formula.name).all()
    return [_formula_to_response(f) for f in rows]


@router.get("", response_model=FormulaListResponse)
def list_formulas(
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.query(Formula).filter(Formula.created_by == user.id).order_by(Formula.created_at.desc()).all()
    return FormulaListResponse(formulas=[_formula_to_response(r) for r in rows], total=len(rows))


@router.post("", response_model=FormulaResponse, status_code=status.HTTP_201_CREATED)
def create_formula(
    body: FormulaCreate,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    formula = Formula(
        created_by=user.id,
        name=body.name,
        expression=body.expression,
        parameters=json.dumps(body.parameters) if body.parameters else None,
        description=body.description,
        nl_prompt=body.nl_prompt,
        formula_type=body.formula_type,
    )
    db.add(formula)
    db.commit()
    db.refresh(formula)
    return _formula_to_response(formula)


@router.post("/evaluate", response_model=FormulaEvaluateResponse)
def evaluate_formula(
    body: FormulaEvaluateRequest,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    formula = db.query(Formula).filter(
        Formula.id == body.formula_id,
        Formula.created_by == user.id,
    ).first()
    if not formula:
        raise HTTPException(status_code=404, detail="Formula not found")

    values: list[float | None] = []
    for row in body.rows:
        # Build variable dict: param_name -> numeric cell value
        variables: dict[str, float] = {}
        for param, col_name in body.column_map.items():
            raw = row.get(col_name)
            try:
                variables[param] = float(raw) if raw not in (None, "", "—") else 0.0
            except (TypeError, ValueError):
                variables[param] = 0.0
        try:
            result = safe_eval_expression(formula.expression, variables)
        except Exception:
            result = None
        values.append(result)

    # Increment usage count
    formula.usage_count = (formula.usage_count or 0) + 1
    db.commit()

    return FormulaEvaluateResponse(column_name=body.output_name, values=values)


@router.delete("/{formula_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_formula(
    formula_id: str,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    formula = db.query(Formula).filter(Formula.id == formula_id, Formula.created_by == user.id).first()
    if not formula:
        raise HTTPException(status_code=404, detail="Formula not found")
    db.delete(formula)
    db.commit()
