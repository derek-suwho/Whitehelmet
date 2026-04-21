"""Application configuration — all secrets from env vars, never hardcoded."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    environment: str = "dev"
    debug: bool = False
    app_name: str = "Whitehelmet API"
    cors_origins: list[str] = ["http://localhost:5173"]

    # Database — accepts any SQLAlchemy URL
    # Supabase:  postgresql+psycopg2://postgres:[password]@db.[ref].supabase.co:5432/postgres
    # MySQL:     mysql+pymysql://[user]:[password]@[host]:3306/[dbname]
    database_url: str = ""

    # AI APIs — server-side only, never exposed to frontend
    anthropic_api_key: str = ""
    openrouter_api_key: str = ""

    # Auth
    auth_service_url: str = ""
    session_secret: str = ""
    csrf_secret: str = ""
    session_expiry_hours: int = 24

    # File upload
    max_upload_size_mb: int = 50
    upload_dir: str = "/var/data/whitehelmet/uploads"

    model_config = {"env_file": ".env", "case_sensitive": False, "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
