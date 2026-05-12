"""Integration tests — template routes."""


def test_create_template(auth_client):
    resp = auth_client.post("/api/templates", json={"name": "QHSE Q1"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "QHSE Q1"
    assert data["status"] == "draft"
    return data["id"]


def test_list_templates(auth_client):
    auth_client.post("/api/templates", json={"name": "T1"})
    auth_client.post("/api/templates", json={"name": "T2"})
    resp = auth_client.get("/api/templates")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_get_template(auth_client):
    created = auth_client.post("/api/templates", json={"name": "T1"}).json()
    resp = auth_client.get(f"/api/templates/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


def test_save_and_list_versions(auth_client):
    tmpl = auth_client.post("/api/templates", json={"name": "T1"}).json()
    schema = {"columns": [{"id": "c1", "name": "Incidents", "type": "number"}]}
    resp = auth_client.post(
        f"/api/templates/{tmpl['id']}/versions",
        json={"schema_json": schema},
    )
    assert resp.status_code == 201
    assert resp.json()["version_number"] == 1


def test_publish_template(auth_client):
    tmpl = auth_client.post("/api/templates", json={"name": "T1"}).json()
    resp = auth_client.patch(f"/api/templates/{tmpl['id']}/status", json={"status": "active"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"


# ── New coverage tests ────────────────────────────────────────────────────────


def test_list_templates_by_type(auth_client):
    """GET /api/templates?type=master filters by template_type."""
    auth_client.post("/api/templates", json={"name": "Sub T", "template_type": "subcontractor"})
    auth_client.post("/api/templates", json={"name": "Master T", "template_type": "master"})
    resp = auth_client.get("/api/templates?type=master")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "Master T"
    assert data[0]["template_type"] == "master"


def test_list_master_templates(auth_client):
    """GET /api/templates/master returns only master-type templates."""
    auth_client.post("/api/templates", json={"name": "Sub T", "template_type": "subcontractor"})
    auth_client.post("/api/templates", json={"name": "Master T", "template_type": "master"})
    resp = auth_client.get("/api/templates/master")
    assert resp.status_code == 200
    data = resp.json()
    assert all(t["template_type"] == "master" for t in data)
    assert any(t["name"] == "Master T" for t in data)


def test_get_template_not_found(auth_client):
    """GET /api/templates/{id} with unknown id returns 404."""
    resp = auth_client.get("/api/templates/nonexistent-id")
    assert resp.status_code == 404


def test_update_template(auth_client):
    """PATCH /api/templates/{id} updates name and description."""
    tmpl = auth_client.post("/api/templates", json={"name": "Original"}).json()
    resp = auth_client.patch(
        f"/api/templates/{tmpl['id']}",
        json={"name": "Updated", "description": "New desc"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated"
    assert data["description"] == "New desc"


def test_update_status_invalid(auth_client):
    """PATCH /api/templates/{id}/status with an invalid status returns 422."""
    tmpl = auth_client.post("/api/templates", json={"name": "T1"}).json()
    resp = auth_client.patch(
        f"/api/templates/{tmpl['id']}/status",
        json={"status": "published"},
    )
    assert resp.status_code == 422


def test_update_status_not_found(auth_client):
    """PATCH /api/templates/{id}/status on a missing template returns 404."""
    resp = auth_client.patch(
        "/api/templates/does-not-exist/status",
        json={"status": "active"},
    )
    assert resp.status_code == 404


def test_list_versions(auth_client):
    """GET /api/templates/{id}/versions returns saved versions."""
    tmpl = auth_client.post("/api/templates", json={"name": "T1"}).json()
    schema = {"columns": [{"id": "c1", "name": "Injuries", "type": "number"}]}
    auth_client.post(f"/api/templates/{tmpl['id']}/versions", json={"schema_json": schema})
    resp = auth_client.get(f"/api/templates/{tmpl['id']}/versions")
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["version_number"] == 1


def test_save_version_increments(auth_client):
    """Saving a second version auto-increments version_number to 2."""
    tmpl = auth_client.post("/api/templates", json={"name": "T1"}).json()
    schema = {"columns": []}
    r1 = auth_client.post(f"/api/templates/{tmpl['id']}/versions", json={"schema_json": schema})
    r2 = auth_client.post(f"/api/templates/{tmpl['id']}/versions", json={"schema_json": schema})
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json()["version_number"] == 1
    assert r2.json()["version_number"] == 2


def test_list_consolidations(auth_client, db):
    """GET /api/templates/{id}/consolidations returns associated consolidated sheets."""
    from app.models.consolidated_sheet import ConsolidatedSheet

    tmpl = auth_client.post("/api/templates", json={"name": "T1"}).json()
    cs = ConsolidatedSheet(
        id="cs-test-1",
        template_id=tmpl["id"],
        file_path="/tmp/fake.xlsx",
    )
    db.add(cs)
    db.commit()

    resp = auth_client.get(f"/api/templates/{tmpl['id']}/consolidations")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["id"] == "cs-test-1"
