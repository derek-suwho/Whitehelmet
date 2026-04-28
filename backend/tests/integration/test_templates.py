"""Integration tests — template routes."""
import json


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
