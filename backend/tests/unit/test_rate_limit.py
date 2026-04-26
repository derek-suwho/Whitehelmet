"""Rate limiting tests."""

import pytest
from app.core.rate_limit import (
    check_rate_limit,
    record_failed_attempt,
    reset_attempts,
    _clear_all,
    MAX_ATTEMPTS,
)


@pytest.fixture(autouse=True)
def clear_rate_limits():
    _clear_all()
    yield
    _clear_all()


def test_first_attempt_allowed():
    allowed, remaining = check_rate_limit("1.2.3.4")
    assert allowed is True
    assert remaining == 0


def test_lockout_after_max_attempts():
    for _ in range(MAX_ATTEMPTS):
        record_failed_attempt("1.2.3.4")
    allowed, remaining = check_rate_limit("1.2.3.4")
    assert allowed is False
    assert remaining > 0


def test_reset_clears_lockout():
    for _ in range(MAX_ATTEMPTS):
        record_failed_attempt("1.2.3.4")
    reset_attempts("1.2.3.4")
    allowed, remaining = check_rate_limit("1.2.3.4")
    assert allowed is True
    assert remaining == 0


def test_login_returns_429_after_lockout(client):
    body = {"email": "notfound@example.com", "password": "wrongpassword"}
    for _ in range(MAX_ATTEMPTS):
        resp = client.post("/api/auth/login", json=body)
        assert resp.status_code == 401
    resp = client.post("/api/auth/login", json=body)
    assert resp.status_code == 429
    assert "Retry-After" in resp.headers
