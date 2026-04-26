"""Admin routes — organizations and users."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.organization import Organization

router = APIRouter(prefix="/api/admin", tags=["admin"])


class OrgCreate(BaseModel):
    name: str
    type: str  # 'pif' | 'devco'
    parent_org_id: str | None = None


class UserCreate(BaseModel):
    email: str
    display_name: str
    org_id: str
    role: str


class RoleUpdate(BaseModel):
    role: str


def _org_to_dict(org: Organization) -> dict:
    return {
        "id": org.external_id,
        "name": org.name,
        "type": "pif" if org.parent_org_id is None else "devco",
        "parent_org_id": None,
        "created_at": org.created_at.isoformat() if org.created_at else None,
    }


@router.get("/organizations")
async def list_organizations(
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    orgs = db.query(Organization).filter(Organization.is_active == True).order_by(Organization.name).all()
    return [_org_to_dict(o) for o in orgs]


@router.post("/organizations", status_code=status.HTTP_201_CREATED)
async def create_organization(
    body: OrgCreate,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    org = Organization(
        external_id=str(uuid.uuid4()),
        name=body.name,
        slug=body.name.lower().replace(" ", "-"),
        is_active=True,
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    return _org_to_dict(org)


@router.get("/users")
async def list_users(
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    from app.models.user import User
    from app.models.organization import OrgMembership

    rows = (
        db.query(User, OrgMembership)
        .outerjoin(OrgMembership, OrgMembership.user_id == User.id)
        .order_by(User.display_name)
        .all()
    )
    result = []
    for user, membership in rows:
        org = db.query(Organization).filter(Organization.id == membership.org_id).first() if membership else None
        result.append({
            "id": user.external_id,
            "display_name": user.display_name,
            "role": membership.system_role if membership else None,
            "org_id": org.external_id if org else None,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "organization": {"name": org.name, "type": "pif" if org.parent_org_id is None else "devco"} if org else None,
        })
    return result


@router.post("/users", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def create_user(body: UserCreate, _user=Depends(get_current_user)):
    raise HTTPException(status_code=501, detail="not implemented")


@router.patch("/users/{user_id}/role", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def update_user_role(user_id: str, body: RoleUpdate, _user=Depends(get_current_user)):
    raise HTTPException(status_code=501, detail="not implemented")
