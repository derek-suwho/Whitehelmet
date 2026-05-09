"""Integration tests — template formula CRUD."""
import pytest

# Valid UUIDs required — SQLAlchemy 2.0 validates UUID(as_uuid=False) columns on reload
_TMPL_ID = "00000000-0000-0000-0000-000000000001"
_VER_ID = "00000000-0000-0000-0000-000000000010"
_FRM_ID_1 = "00000000-0000-0000-0000-000000000011"
_FRM_ID_2 = "00000000-0000-0000-0000-000000000012"
_FRM_ID_3 = "00000000-0000-0000-0000-000000000013"


@pytest.fixture
def pif_admin_client(client, db, test_user):
    from app.core.dependencies import get_current_user
    test_user.role = "org_super_admin"
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
    t = Template(id=_TMPL_ID, name="KPI Template", status="active", template_type="subcontractor")
    db.add(t)
    v = TemplateVersion(id=_VER_ID, template_id=_TMPL_ID, version_number=1,
                        schema_json='{"columns": []}', created_by=None)
    db.add(v)
    db.commit()
    return v


def test_create_formula(pif_admin_client, template_version):
    resp = pif_admin_client.post(f"/api/admin/template-versions/{_VER_ID}/formulas", json={
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
    assert data["template_version_id"] == _VER_ID


def test_list_formulas(pif_admin_client, template_version, db):
    from app.models.template_formula import TemplateFormula
    f = TemplateFormula(id=_FRM_ID_1, template_version_id=_VER_ID,
                        name="Test", target_column="B", formula_type="column",
                        expression="=A{row}/2")
    db.add(f)
    db.commit()
    resp = pif_admin_client.get(f"/api/admin/template-versions/{_VER_ID}/formulas")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_update_formula(pif_admin_client, template_version, db):
    from app.models.template_formula import TemplateFormula
    f = TemplateFormula(id=_FRM_ID_2, template_version_id=_VER_ID,
                        name="Old", target_column="C", formula_type="column",
                        expression="=A{row}")
    db.add(f)
    db.commit()
    resp = pif_admin_client.put(f"/api/admin/formulas/{_FRM_ID_2}", json={"name": "New"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "New"


def test_delete_formula(pif_admin_client, template_version, db):
    from app.models.template_formula import TemplateFormula
    f = TemplateFormula(id=_FRM_ID_3, template_version_id=_VER_ID,
                        name="Del", target_column="D", formula_type="column",
                        expression="=A{row}")
    db.add(f)
    db.commit()
    resp = pif_admin_client.delete(f"/api/admin/formulas/{_FRM_ID_3}")
    assert resp.status_code == 204
    assert db.query(TemplateFormula).filter_by(id=_FRM_ID_3).first() is None
