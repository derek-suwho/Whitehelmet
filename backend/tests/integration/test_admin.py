"""Integration tests — admin routes."""


def test_list_users(pif_admin_client, test_user):
    resp = pif_admin_client.get("/api/admin/users")
    assert resp.status_code == 200
    users = resp.json()
    assert any(u["display_name"] == "Test User" for u in users)


def test_update_user_role(pif_admin_client, test_user):
    resp = pif_admin_client.patch(
        f"/api/admin/users/{test_user.id}/role",
        json={"role": "org_admin"},
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "org_admin"
