"""Whitehelmet API — FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api.routes import health, auth, ai, records, files

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
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)

# Routes
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(ai.router)
app.include_router(records.router)
app.include_router(files.router)


@app.on_event("startup")
async def startup():
    """Create tables on startup (use Alembic migrations in production)."""
    from app.db.session import engine, Base
    from app.models import User, Record, UploadedFile, ConversationMessage, SessionModel

    if settings.environment == "dev":
        Base.metadata.create_all(bind=engine)
