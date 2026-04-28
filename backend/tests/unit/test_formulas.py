"""Formula library CRUD tests."""


def test_create_formula(auth_client):
    resp = auth_client.post("/api/formulas", json={
        "name": "Total Cost",
        "expression": "=A{row}*B{row}",
        "description": "Quantity times unit price",
        "formula_type": "calculation",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Total Cost"
    assert data["expression"] == "=A{row}*B{row}"
    assert data["description"] == "Quantity times unit price"
    assert data["formula_type"] == "calculation"
    assert "id" in data
    assert "created_at" in data


def test_create_formula_minimal(auth_client):
    resp = auth_client.post("/api/formulas", json={
        "name": "Simple",
        "expression": "=SUM(A{row}:C{row})",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Simple"
    assert data["description"] is None
    assert data["nl_prompt"] is None


def test_list_formulas_empty(auth_client):
    resp = auth_client.get("/api/formulas")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 0
    assert body["formulas"] == []


def test_list_formulas_after_create(auth_client):
    auth_client.post("/api/formulas", json={"name": "F1", "expression": "=A{row}"})
    auth_client.post("/api/formulas", json={"name": "F2", "expression": "=B{row}"})
    resp = auth_client.get("/api/formulas")
    body = resp.json()
    assert body["total"] == 2
    names = [f["name"] for f in body["formulas"]]
    assert "F1" in names
    assert "F2" in names


def test_list_formulas_returns_all_created(auth_client):
    auth_client.post("/api/formulas", json={"name": "First", "expression": "=A{row}"})
    auth_client.post("/api/formulas", json={"name": "Second", "expression": "=B{row}"})
    resp = auth_client.get("/api/formulas")
    formulas = resp.json()["formulas"]
    assert len(formulas) == 2
    names = {f["name"] for f in formulas}
    assert names == {"First", "Second"}


def test_delete_formula(auth_client):
    create_resp = auth_client.post("/api/formulas", json={"name": "To Delete", "expression": "=A{row}"})
    formula_id = create_resp.json()["id"]
    del_resp = auth_client.delete(f"/api/formulas/{formula_id}")
    assert del_resp.status_code == 204
    # Verify it's gone
    list_resp = auth_client.get("/api/formulas")
    assert list_resp.json()["total"] == 0


def test_delete_nonexistent_formula(auth_client):
    resp = auth_client.delete("/api/formulas/99999")
    assert resp.status_code == 404


def test_unauthenticated_list(client):
    resp = client.get("/api/formulas")
    assert resp.status_code == 401


def test_unauthenticated_create(client):
    resp = client.post("/api/formulas", json={"name": "X", "expression": "=A{row}"})
    assert resp.status_code == 401


def test_unauthenticated_delete(client):
    resp = client.delete("/api/formulas/1")
    assert resp.status_code == 401
