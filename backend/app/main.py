"""Whitehelmet API — FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api.routes import health, auth, ai, records, files, projects, admin, templates, assignments, subcontractor, formulas

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    docs_url="/docs" if settings.debug else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.debug else None,
)

# CORS — restrict to frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Content-Type", "X-CSRF-Token", "Authorization"],
)

# Routes
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(ai.router)
app.include_router(records.router)
app.include_router(files.router)
app.include_router(projects.router)
app.include_router(admin.router)
app.include_router(templates.router)
app.include_router(assignments.router)
app.include_router(subcontractor.router)
app.include_router(formulas.router)


@app.on_event("startup")
async def startup():
    """Create tables on startup (use Alembic migrations in production).

    Tolerant of missing DB so AI proxy routes work without MySQL running.
    """
    from app.db.session import engine, Base
    from app.models import (  # noqa: F401
        User, Record, UploadedFile, ConversationMessage, SessionModel,
        Project, ProjectMember, Template, TemplateVersion, TemplateAssignment,
        Submission, ConsolidatedSheet, Formula,
    )

    if settings.environment in ("dev", "staging"):
        try:
            Base.metadata.create_all(bind=engine)
            _migrate_columns(engine)
            _seed_admin(engine)
        except Exception as e:
            print(f"[WARN] DB unavailable on startup ({e.__class__.__name__}) - AI routes still work, DB-backed routes will 500")


def _migrate_columns(engine):
    """Add new columns to existing tables that predate them."""
    from sqlalchemy import text
    migrations = [
        "ALTER TABLE projects ADD COLUMN master_template_id VARCHAR(36) NULL",
        "ALTER TABLE consolidated_sheets ADD COLUMN project_id VARCHAR(36) NULL",
        "ALTER TABLE consolidated_sheets ADD COLUMN name VARCHAR(255) NULL",
        "ALTER TABLE consolidated_sheets ADD COLUMN period VARCHAR(50) NULL",
        "ALTER TABLE template_assignments ADD COLUMN reporting_period VARCHAR(50) NULL",
        "ALTER TABLE submissions ADD COLUMN reporting_period VARCHAR(50) NULL",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # column already exists


def _seed_admin(engine):
    """Create default admin user on first run if no users exist."""
    from sqlalchemy.orm import Session
    from app.models.user import User
    from app.core.security import hash_password
    import uuid

    with Session(engine) as db:
        if db.query(User).count() == 0:
            admin = User(
                external_id=str(uuid.uuid4()),
                email="admin@whitehelmet.dev",
                display_name="Admin",
                password_hash=hash_password("Admin1234!"),
                role="org_super_admin",
            )
            db.add(admin)
            db.commit()
            print("[SEED] Created default admin: admin@whitehelmet.dev / Admin1234!")
