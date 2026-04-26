"""Organization routes — list and create orgs."""
import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, verify_csrf
from app.db.session import get_db
from app.models.organization import Organization
from app.models.user import User
from app.schemas.organizations import OrganizationCreate, OrganizationResponse

router = APIRouter(
    prefix="/api/organizations",
    tags=["organizations"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=list[OrganizationResponse])
def list_organizations(db: Session = Depends(get_db)):
    return db.query(Organization).order_by(Organization.name).all()


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(verify_csrf)])
def create_organization(body: OrganizationCreate, db: Session = Depends(get_db)):
    org = Organization(
        id=str(uuid.uuid4()),
        name=body.name,
        type=body.type,
        parent_org_id=body.parent_org_id,
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    return org
