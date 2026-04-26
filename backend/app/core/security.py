"""Security utilities: session tokens, CSRF, password hashing."""

import secrets
import hashlib
import hmac
from datetime import datetime, timedelta, timezone

from passlib.context import CryptContext

from app.core.config import get_settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


def generate_session_token() -> str:
    """Generate cryptographically random 128-bit session token."""
    return secrets.token_hex(16)


def generate_csrf_token(session_token: str) -> str:
    """Generate CSRF token bound to a session."""
    settings = get_settings()
    return hmac.new(
        settings.csrf_secret.encode(),
        session_token.encode(),
        hashlib.sha256,
    ).hexdigest()


def verify_csrf_token(session_token: str, csrf_token: str) -> bool:
    """Verify CSRF token matches session."""
    expected = generate_csrf_token(session_token)
    return hmac.compare_digest(expected, csrf_token)


def session_expiry() -> datetime:
    """Return expiry timestamp for a new session."""
    settings = get_settings()
    return datetime.now(timezone.utc) + timedelta(hours=settings.session_expiry_hours)


def hash_file(data: bytes) -> str:
    """SHA-256 hash of file content for integrity checks."""
    return hashlib.sha256(data).hexdigest()
