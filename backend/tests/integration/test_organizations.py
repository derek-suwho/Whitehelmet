"""Integration tests — organization routes."""


def test_list_organizations_empty(auth_client):
    resp = auth_client.get("/api/organizations")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_and_list_organization(auth_client):
    resp = auth_client.post("/api/organizations", json={"name": "PIF", "type": "pif"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "PIF"
    assert data["type"] == "pif"

    resp2 = auth_client.get("/api/organizations")
    assert len(resp2.json()) == 1
