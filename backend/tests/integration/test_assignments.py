"""Integration tests — assignment routes."""


def test_create_template_assignment(auth_client):
    resp = auth_client.post("/api/assignments", json={
        "template_version_id": "ver-1",
        "org_ids": ["org-1", "org-2"],
        "deadline": "2026-06-01",
        "submission_type": "template",
    })
    assert resp.status_code == 201
    assignments = resp.json()
    assert len(assignments) == 2
    assert all(a["status"] == "pending" for a in assignments)


def test_create_freeform_assignment(auth_client):
    resp = auth_client.post("/api/assignments", json={
        "org_id": "org-1",
        "org_ids": [],
        "submission_type": "freeform",
    })
    assert resp.status_code == 201
    assignments = resp.json()
    assert len(assignments) == 1
    assert assignments[0]["upload_token"] is not None
