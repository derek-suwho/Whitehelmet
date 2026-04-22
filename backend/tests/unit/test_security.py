"""Security utility tests."""

from app.core.security import (
    generate_session_token,
    generate_csrf_token,
    verify_csrf_token,
    hash_file,
)


def test_session_token_length():
    token = generate_session_token()
    assert len(token) == 32  # 16 bytes = 32 hex chars


def test_session_token_uniqueness():
    tokens = {generate_session_token() for _ in range(100)}
    assert len(tokens) == 100


def test_csrf_roundtrip():
    session = generate_session_token()
    csrf = generate_csrf_token(session)
    assert verify_csrf_token(session, csrf)


def test_csrf_rejects_wrong_session():
    s1 = generate_session_token()
    s2 = generate_session_token()
    csrf = generate_csrf_token(s1)
    assert not verify_csrf_token(s2, csrf)


def test_file_hash_deterministic():
    data = b"test file content"
    assert hash_file(data) == hash_file(data)


def test_file_hash_different_content():
    assert hash_file(b"a") != hash_file(b"b")
