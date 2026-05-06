"""Test Organization model — PIF (root) and DevCo (member) tenants."""

# Valid UUIDs required — SQLAlchemy 2.0 validates UUID(as_uuid=False) values on reload
ORG_PIF_ID = "00000000-0000-0000-0000-000000000001"
ORG_DEVCO_ID = "00000000-0000-0000-0000-000000000002"


def test_create_organization(db):
    """Organization should be creatable with id, name, type, and optional parent_org_id."""
    from app.models.organization import Organization

    org = Organization(id=ORG_PIF_ID, name="PIF", type="pif")
    db.add(org)
    db.commit()
    db.refresh(org)

    assert org.id == ORG_PIF_ID
    assert org.name == "PIF"
    assert org.type == "pif"
    assert org.parent_org_id is None
    assert org.created_at is not None


def test_create_devco_organization(db):
    """DevCo organization should reference parent org."""
    from app.models.organization import Organization

    pif_org = Organization(id=ORG_PIF_ID, name="PIF", type="pif")
    db.add(pif_org)
    db.commit()

    devco_org = Organization(id=ORG_DEVCO_ID, name="DevCo A", type="devco", parent_org_id=ORG_PIF_ID)
    db.add(devco_org)
    db.commit()
    db.refresh(devco_org)

    assert devco_org.parent_org_id == ORG_PIF_ID
    assert devco_org.type == "devco"
