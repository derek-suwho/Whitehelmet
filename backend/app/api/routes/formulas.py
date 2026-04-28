"""Formula library CRUD routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, verify_csrf
from app.db.session import get_db
from app.models.formula import Formula
from app.models.user import User
from app.schemas.formula import FormulaCreate, FormulaResponse, FormulaListResponse

router = APIRouter(
    prefix="/api/formulas",
    tags=["formulas"],
    dependencies=[Depends(get_current_user), Depends(verify_csrf)],
)


@router.get("", response_model=FormulaListResponse)
def list_formulas(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Formula)
        .filter(Formula.user_id == user.id)
        .order_by(Formula.created_at.desc())
        .all()
    )
    return FormulaListResponse(formulas=rows, total=len(rows))


@router.post("", response_model=FormulaResponse, status_code=status.HTTP_201_CREATED)
def create_formula(
    body: FormulaCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    formula = Formula(
        user_id=user.id,
        name=body.name,
        expression=body.expression,
        description=body.description,
        nl_prompt=body.nl_prompt,
        formula_type=body.formula_type,
    )
    db.add(formula)
    db.commit()
    db.refresh(formula)
    return formula


@router.delete("/{formula_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_formula(
    formula_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    formula = (
        db.query(Formula)
        .filter(Formula.id == formula_id, Formula.user_id == user.id)
        .first()
    )
    if not formula:
        raise HTTPException(status_code=404, detail="Formula not found")
    db.delete(formula)
    db.commit()
