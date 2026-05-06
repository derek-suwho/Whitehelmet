"""Whitehelmet API — FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api.routes import health, auth, ai, records, files, projects, admin, templates, assignments, subcontractor, formulas, organizations

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    docs_url="/docs" if settings.debug else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.debug else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Content-Type", "Authorization"],
)

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
app.include_router(organizations.router)
