"""Database session management with connection pooling."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import get_settings

settings = get_settings()

_connect_args: dict = {}
if settings.database_url.startswith("mysql") and settings.db_ssl_ca:
    _connect_args = {"ssl_ca": settings.db_ssl_ca}

engine = create_engine(
    settings.database_url,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
    connect_args=_connect_args,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Yield a DB session, auto-close on completion."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
