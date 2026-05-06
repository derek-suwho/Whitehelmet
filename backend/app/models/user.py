"""Backward-compat shim — User is now Profile."""
from app.models.profile import Profile as User  # noqa: F401
