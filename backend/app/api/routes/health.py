"""Health and readiness probes for K8s."""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    """Liveness probe — always returns OK if process is running."""
    return {"status": "ok"}


@router.get("/ready")
async def ready(db: Session = Depends(get_db)):
    """Readiness probe — checks DB connectivity."""
    checks = {"database": False}

    try:
        db.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception:
        pass

    all_ready = all(checks.values())
    return {"status": "ready" if all_ready else "not_ready", "checks": checks}
