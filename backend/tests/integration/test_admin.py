"""Integration tests — admin routes."""


def test_list_users(auth_client, test_user):
    resp = auth_client.get("/api/admin/users")
    assert resp.status_code == 200
    users = resp.json()
    assert any(u["email"] == "test@whitehelmet.com" for u in users)


def test_update_user_role(auth_client, test_user):
    resp = auth_client.patch(
        f"/api/admin/users/{test_user.id}/role",
        json={"role": "devco_admin"},
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "devco_admin"
