"""Integration tests — template formula CRUD."""
import pytest


@pytest.fixture
def pif_admin_client(client, db, test_user):
    from app.core.dependencies import get_current_user
    test_user.role = "pif_admin"
    db.commit()

    async def override():
        return test_user

    client.app.dependency_overrides[get_current_user] = override
    yield client
    client.app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def template_version(db):
    from app.models.template import Template
    from app.models.template_version import TemplateVersion
    t = Template(id="tmpl-1", name="KPI Template", status="active", template_type="subcontractor")
    db.add(t)
    v = TemplateVersion(id="ver-1", template_id="tmpl-1", version_number=1,
                        schema_json='{"columns": []}', created_by=None)
    db.add(v)
    db.commit()
    return v


def test_create_formula(pif_admin_client, template_version):
    resp = pif_admin_client.post(f"/api/admin/template-versions/{template_version.id}/formulas", json={
        "name": "TRIR",
        "target_column": "E",
        "formula_type": "column",
        "expression": "=O{row}/N{row}",
        "weight": 0.2,
        "benchmark": 0.95,
        "scoring_rules": [{"min": None, "max": 0.01, "score": 100}],
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "TRIR"
    assert data["template_version_id"] == template_version.id


def test_list_formulas(pif_admin_client, template_version, db):
    from app.models.template_formula import TemplateFormula
    f = TemplateFormula(id="frm-1", template_version_id=template_version.id,
                        name="Test", target_column="B", formula_type="column",
                        expression="=A{row}/2")
    db.add(f)
    db.commit()
    resp = pif_admin_client.get(f"/api/admin/template-versions/{template_version.id}/formulas")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_update_formula(pif_admin_client, template_version, db):
    from app.models.template_formula import TemplateFormula
    f = TemplateFormula(id="frm-2", template_version_id=template_version.id,
                        name="Old", target_column="C", formula_type="column",
                        expression="=A{row}")
    db.add(f)
    db.commit()
    resp = pif_admin_client.put(f"/api/admin/formulas/frm-2", json={"name": "New"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "New"


def test_delete_formula(pif_admin_client, template_version, db):
    from app.models.template_formula import TemplateFormula
    f = TemplateFormula(id="frm-3", template_version_id=template_version.id,
                        name="Del", target_column="D", formula_type="column",
                        expression="=A{row}")
    db.add(f)
    db.commit()
    resp = pif_admin_client.delete(f"/api/admin/formulas/frm-3")
    assert resp.status_code == 204
    assert db.query(TemplateFormula).filter_by(id="frm-3").first() is None
