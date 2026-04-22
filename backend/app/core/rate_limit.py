"""In-memory rate limiting for login endpoint."""

import time
from dataclasses import dataclass, field

MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 15 * 60  # 15 minutes


@dataclass
class AttemptRecord:
    count: int = 0
    lockout_until: float = 0.0


_attempts: dict[str, AttemptRecord] = {}


def check_rate_limit(ip: str) -> tuple[bool, int]:
    """Check if IP is allowed to attempt login.

    Returns (allowed, remaining_lockout_seconds).
    """
    record = _attempts.get(ip)
    if not record:
        return True, 0
    if record.lockout_until > time.time():
        remaining = int(record.lockout_until - time.time()) + 1
        return False, remaining
    # Lockout expired — reset
    if record.lockout_until > 0 and record.lockout_until <= time.time():
        _attempts.pop(ip, None)
        return True, 0
    return True, 0


def record_failed_attempt(ip: str) -> None:
    """Record a failed login attempt for the given IP."""
    record = _attempts.setdefault(ip, AttemptRecord())
    record.count += 1
    if record.count >= MAX_ATTEMPTS:
        record.lockout_until = time.time() + LOCKOUT_SECONDS


def reset_attempts(ip: str) -> None:
    """Clear all attempts for IP (call on successful login)."""
    _attempts.pop(ip, None)


def _clear_all() -> None:
    """For testing only."""
    _attempts.clear()
