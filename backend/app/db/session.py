"""Database session management with connection pooling."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import get_settings

settings = get_settings()

_sqlite = settings.database_url.startswith("sqlite")
_connect_args: dict = {}
if _sqlite:
    _connect_args = {"check_same_thread": False}
elif settings.database_url.startswith("mysql") and settings.db_ssl_ca:
    _connect_args = {"ssl_ca": settings.db_ssl_ca}

engine = create_engine(
    settings.database_url,
    **({} if _sqlite else dict(pool_size=10, max_overflow=20, pool_recycle=3600)),
    pool_pre_ping=True,
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
