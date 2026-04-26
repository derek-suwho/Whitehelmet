"""Auth dependency tests — session/CSRF validation edge cases."""

from datetime import datetime, timedelta, timezone

from app.models.session import SessionModel
from app.core.security import generate_session_token, generate_csrf_token


def test_missing_cookie_401(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_expired_session_401(client, db, test_user):
    token = generate_session_token()
    expired = datetime.now(timezone.utc) - timedelta(hours=1)
    session = SessionModel(token=token, user_id=test_user.id, expires_at=expired)
    db.add(session)
    db.commit()

    client.cookies.set("session_id", token)
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_csrf_missing_header_403(client, db, test_user):
    token = generate_session_token()
    session = SessionModel(
        token=token,
        user_id=test_user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(session)
    db.commit()

    client.cookies.set("session_id", token)
    # POST without X-CSRF-Token → 403 on CSRF-protected routes
    resp = client.post(
        "/api/records",
        json={"name": "test", "source_count": 1, "row_count": 1, "col_count": 1},
    )
    assert resp.status_code == 403


def test_csrf_mismatch_403(client, db, test_user):
    token = generate_session_token()
    session = SessionModel(
        token=token,
        user_id=test_user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(session)
    db.commit()

    client.cookies.set("session_id", token)
    client.headers["X-CSRF-Token"] = "wrong-csrf-token"
    resp = client.post(
        "/api/records",
        json={"name": "test", "source_count": 1, "row_count": 1, "col_count": 1},
    )
    assert resp.status_code == 403
