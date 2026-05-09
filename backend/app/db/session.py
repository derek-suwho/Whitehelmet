"""Database session — PostgreSQL via Supabase."""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import get_settings

settings = get_settings()

# SQLite supported for local unit tests; production uses Supabase PostgreSQL
_sqlite = settings.database_url.startswith("sqlite")
_connect_args = {"check_same_thread": False} if _sqlite else {}

engine = create_engine(
    settings.database_url,
    **({} if _sqlite else {"pool_size": 10, "max_overflow": 20, "pool_recycle": 3600}),
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
