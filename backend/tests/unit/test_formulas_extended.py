"""Extended formula tests — library, bulk-save, evaluate, _formula_to_response."""

import json
import uuid

from app.models.formula import Formula
from app.models.template_formula import TemplateFormula
from app.models.template_version import TemplateVersion
from app.models.template import Template


# ── Library formulas ─────────────────────────────────────────────────────────

def test_list_library_formulas_empty(auth_client):
    resp = auth_client.get("/api/formulas/library")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_library_formulas_returns_presets(auth_client, db):
    f = Formula(
        id=str(uuid.uuid4()),
        name="FR Preset",
        expression="=H{row}*200000/F{row}",
        formula_type="calculation",
        is_library_item=True,
        created_by="system",
    )
    db.add(f)
    db.commit()
    resp = auth_client.get("/api/formulas/library")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "FR Preset"
    assert data[0]["is_library_item"] is True


# ── Bulk save ────────────────────────────────────────────────────────────────

def test_bulk_save_creates_formulas(pif_admin_client, db):
    tpl = Template(id=str(uuid.uuid4()), name="Safety", created_by="test")
    db.add(tpl)
    db.commit()
    tv = TemplateVersion(
        id=str(uuid.uuid4()),
        template_id=tpl.id,
        version_number=1,
        schema_json="[]",
    )
    db.add(tv)
    db.commit()

    resp = pif_admin_client.post(
        f"/api/formulas/bulk-save?template_version_id={tv.id}",
        json=[
            {"name": "Sum F", "target_column": "F", "expression": "=SUM(F10:F14)", "formula_type": "single_cell"},
            {"name": "Sum H", "target_column": "H", "expression": "=SUM(H10:H14)", "formula_type": "single_cell"},
        ],
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["replaced"] == 2
    assert len(data["ids"]) == 2


def test_bulk_save_replaces_existing(pif_admin_client, db):
    tpl = Template(id=str(uuid.uuid4()), name="Safety", created_by="test")
    db.add(tpl)
    db.commit()
    tv = TemplateVersion(
        id=str(uuid.uuid4()),
        template_id=tpl.id,
        version_number=1,
        schema_json="[]",
    )
    db.add(tv)
    # Pre-existing formula
    old = TemplateFormula(
        id=str(uuid.uuid4()),
        template_version_id=tv.id,
        name="Old",
        target_column="A",
        expression="=A1",
    )
    db.add(old)
    db.commit()

    resp = pif_admin_client.post(
        f"/api/formulas/bulk-save?template_version_id={tv.id}",
        json=[
            {"name": "New", "target_column": "B", "expression": "=B1", "formula_type": "column"},
        ],
    )
    assert resp.status_code == 200
    assert resp.json()["replaced"] == 1
    # Old formula should be gone
    remaining = db.query(TemplateFormula).filter(
        TemplateFormula.template_version_id == tv.id
    ).all()
    assert len(remaining) == 1
    assert remaining[0].name == "New"


def test_bulk_save_tv_not_found(pif_admin_client):
    resp = pif_admin_client.post(
        "/api/formulas/bulk-save?template_version_id=nonexistent",
        json=[{"name": "X", "target_column": "A", "expression": "=A1", "formula_type": "column"}],
    )
    assert resp.status_code == 404


# ── Evaluate formula ─────────────────────────────────────────────────────────

def test_evaluate_formula_computes(auth_client, db, test_user):
    f = Formula(
        id=str(uuid.uuid4()),
        name="Multiply",
        expression="a * b",
        formula_type="calculation",
        created_by=test_user.id,
    )
    db.add(f)
    db.commit()

    resp = auth_client.post("/api/formulas/evaluate", json={
        "formula_id": f.id,
        "column_map": {"a": "qty", "b": "price"},
        "output_name": "total",
        "rows": [
            {"qty": 10, "price": 5},
            {"qty": 3, "price": 7},
        ],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["column_name"] == "total"
    assert data["values"] == [50.0, 21.0]


def test_evaluate_formula_handles_nulls(auth_client, db, test_user):
    f = Formula(
        id=str(uuid.uuid4()),
        name="Add",
        expression="a + b",
        formula_type="calculation",
        created_by=test_user.id,
    )
    db.add(f)
    db.commit()

    resp = auth_client.post("/api/formulas/evaluate", json={
        "formula_id": f.id,
        "column_map": {"a": "x", "b": "y"},
        "output_name": "sum",
        "rows": [{"x": None, "y": ""}, {"x": "5", "y": "3"}],
    })
    assert resp.status_code == 200
    vals = resp.json()["values"]
    assert vals[0] == 0.0
    assert vals[1] == 8.0


def test_evaluate_formula_not_found(auth_client):
    resp = auth_client.post("/api/formulas/evaluate", json={
        "formula_id": "nonexistent",
        "column_map": {"a": "x"},
        "output_name": "out",
        "rows": [{"x": 1}],
    })
    assert resp.status_code == 404


def test_evaluate_increments_usage(auth_client, db, test_user):
    f = Formula(
        id=str(uuid.uuid4()),
        name="Inc",
        expression="a + 1",
        formula_type="calculation",
        created_by=test_user.id,
        usage_count=0,
    )
    db.add(f)
    db.commit()

    auth_client.post("/api/formulas/evaluate", json={
        "formula_id": f.id,
        "column_map": {"a": "x"},
        "output_name": "out",
        "rows": [{"x": 1}],
    })
    db.refresh(f)
    assert f.usage_count == 1


# ── _formula_to_response ─────────────────────────────────────────────────────

def test_formula_with_json_params(auth_client, db, test_user):
    f = Formula(
        id=str(uuid.uuid4()),
        name="Parameterized",
        expression="a + b",
        parameters=json.dumps(["a", "b"]),
        formula_type="calculation",
        created_by=test_user.id,
    )
    db.add(f)
    db.commit()
    resp = auth_client.get("/api/formulas")
    data = resp.json()["formulas"]
    assert len(data) == 1
    assert data[0]["parameters"] == ["a", "b"]


def test_formula_with_invalid_json_params(auth_client, db, test_user):
    f = Formula(
        id=str(uuid.uuid4()),
        name="Bad Params",
        expression="x",
        parameters="not-json{{{",
        formula_type="calculation",
        created_by=test_user.id,
    )
    db.add(f)
    db.commit()
    resp = auth_client.get("/api/formulas")
    data = resp.json()["formulas"]
    assert len(data) == 1
    assert data[0]["parameters"] is None
