"""Records CRUD tests."""


def test_create_record(auth_client):
    resp = auth_client.post("/api/records", json={
        "name": "Test Consolidation",
        "source_count": 3,
        "row_count": 100,
        "col_count": 5,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Consolidation"
    assert data["source_count"] == 3


def test_list_records_empty(auth_client):
    resp = auth_client.get("/api/records")
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


def test_list_records_after_create(auth_client):
    auth_client.post("/api/records", json={"name": "Rec1"})
    auth_client.post("/api/records", json={"name": "Rec2"})
    resp = auth_client.get("/api/records")
    assert resp.json()["total"] == 2


def test_delete_record(auth_client):
    create_resp = auth_client.post("/api/records", json={"name": "To Delete"})
    record_id = create_resp.json()["id"]
    del_resp = auth_client.delete(f"/api/records/{record_id}")
    assert del_resp.status_code == 204


def test_delete_nonexistent_record(auth_client):
    resp = auth_client.delete("/api/records/99999")
    assert resp.status_code == 404


def test_unauthenticated_access(client):
    resp = client.get("/api/records")
    assert resp.status_code == 401
