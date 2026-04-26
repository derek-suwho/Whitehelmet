"""Auth endpoint tests."""

from app.models.session import SessionModel


def test_login_invalid_credentials_401(client):
    resp = client.post(
        "/api/auth/login",
        json={"email": "notfound@example.com", "password": "wrongpassword"},
    )
    assert resp.status_code == 401


def test_logout_deletes_session(auth_client, db):
    resp = auth_client.post("/api/auth/logout")
    assert resp.status_code == 200
    assert db.query(SessionModel).count() == 0


def test_logout_clears_cookie(auth_client):
    resp = auth_client.post("/api/auth/logout")
    assert resp.status_code == 200
    # FastAPI deletes cookies by setting max-age=0
    cookie_header = resp.headers.get("set-cookie", "")
    assert "session_id" in cookie_header


def test_me_returns_user(auth_client):
    resp = auth_client.get("/api/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "test@whitehelmet.com"
    assert data["display_name"] == "Test User"


def test_me_unauthenticated(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401
