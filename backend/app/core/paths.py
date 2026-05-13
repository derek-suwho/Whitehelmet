"""Portable file-path helpers — store relative paths in DB, resolve at runtime."""

from pathlib import Path

from app.core.config import get_settings


def resolve_path(db_path: str | None) -> Path | None:
    """Turn a DB-stored path into an absolute Path on the current machine.

    - None / empty → None
    - Already absolute → returned as-is (legacy rows)
    - Relative → prepended with settings.upload_dir
    """
    if not db_path:
        return None
    p = Path(db_path)
    if p.is_absolute():
        return p
    return Path(get_settings().upload_dir) / p


def to_relative(absolute_path: str | Path) -> str:
    """Strip the upload_dir prefix so only the relative portion is stored in DB.

    If the path doesn't start with upload_dir (shouldn't happen), return as-is.
    """
    p = Path(absolute_path)
    upload_root = Path(get_settings().upload_dir)
    try:
        return str(p.relative_to(upload_root))
    except ValueError:
        return str(p)
