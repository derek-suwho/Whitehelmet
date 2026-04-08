"""Records CRUD — user-scoped master record management."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, verify_csrf
from app.db.session import get_db
from app.models.record import Record
from app.models.user import User
from app.schemas.records import RecordCreate, RecordResponse, RecordList

router = APIRouter(
    prefix="/api/records",
    tags=["records"],
    dependencies=[Depends(get_current_user), Depends(verify_csrf)],
)


@router.get("", response_model=RecordList)
async def list_records(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all records for the authenticated user."""
    records = (
        db.query(Record)
        .filter(Record.user_id == user.id)
        .order_by(Record.created_at.desc())
        .all()
    )
    return RecordList(
        records=[RecordResponse.model_validate(r) for r in records],
        total=len(records),
    )


@router.post("", response_model=RecordResponse, status_code=status.HTTP_201_CREATED)
async def create_record(
    body: RecordCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new master record."""
    record = Record(
        user_id=user.id,
        name=body.name,
        source_count=body.source_count,
        row_count=body.row_count,
        col_count=body.col_count,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/{record_id}", response_model=RecordResponse)
async def get_record(
    record_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific record (user-scoped)."""
    record = (
        db.query(Record)
        .filter(Record.id == record_id, Record.user_id == user.id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_record(
    record_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a record (user-scoped)."""
    record = (
        db.query(Record)
        .filter(Record.id == record_id, Record.user_id == user.id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    db.delete(record)
    db.commit()
