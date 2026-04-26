"""Test Organization model — PIF (root) and DevCo (member) tenants."""

import pytest


def test_create_organization(db):
    """Organization should be creatable with id, name, type, and optional parent_org_id."""
    from app.models.organization import Organization

    org = Organization(id="org-1", name="PIF", type="pif")
    db.add(org)
    db.commit()
    db.refresh(org)

    assert org.id == "org-1"
    assert org.name == "PIF"
    assert org.type == "pif"
    assert org.parent_org_id is None
    assert org.created_at is not None


def test_create_devco_organization(db):
    """DevCo organization should reference parent org."""
    from app.models.organization import Organization

    pif_org = Organization(id="org-pif", name="PIF", type="pif")
    db.add(pif_org)
    db.commit()

    devco_org = Organization(id="org-devco-1", name="DevCo A", type="devco", parent_org_id="org-pif")
    db.add(devco_org)
    db.commit()
    db.refresh(devco_org)

    assert devco_org.parent_org_id == "org-pif"
    assert devco_org.type == "devco"
