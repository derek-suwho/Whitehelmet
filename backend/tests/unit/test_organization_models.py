# backend/tests/unit/test_organization_models.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.session import Base
from app.models.organization import Organization, OrgMembership
from app.models.user import User


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(engine)


def test_create_root_org(db):
    org = Organization(external_id="pif-001", name="Public Investment Fund", slug="pif")
    db.add(org)
    db.commit()
    db.refresh(org)
    assert org.id is not None
    assert org.parent_org_id is None
    assert org.is_active is True


def test_create_child_org(db):
    root = Organization(external_id="pif-001", name="PIF", slug="pif")
    db.add(root)
    db.commit()
    child = Organization(external_id="devco-001", name="DevCo A", slug="devco-a", parent_org_id=root.id)
    db.add(child)
    db.commit()
    db.refresh(child)
    assert child.parent_org_id == root.id


def test_org_membership_unique_per_user_org(db):
    from sqlalchemy.exc import IntegrityError
    org = Organization(external_id="org-001", name="Org", slug="org")
    user = User(external_id="u-001", email="a@b.com", display_name="Alice")
    db.add_all([org, user])
    db.commit()
    m1 = OrgMembership(user_id=user.id, org_id=org.id, system_role="devco_user")
    db.add(m1)
    db.commit()
    m2 = OrgMembership(user_id=user.id, org_id=org.id, system_role="devco_admin")
    db.add(m2)
    with pytest.raises(IntegrityError):
        db.commit()


def test_org_membership_valid_roles(db):
    org = Organization(external_id="org-002", name="Org2", slug="org2")
    user = User(external_id="u-002", email="b@c.com", display_name="Bob")
    db.add_all([org, user])
    db.commit()
    for role in ("pif_admin", "devco_admin", "devco_user"):
        m = OrgMembership(user_id=user.id, org_id=org.id, system_role=role)
        db.add(m)
        db.commit()
        db.delete(m)
        db.commit()
