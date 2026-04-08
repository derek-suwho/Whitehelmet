"""Application configuration — all secrets from env vars, never hardcoded."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    environment: str = "dev"
    debug: bool = False
    app_name: str = "Whitehelmet API"
    cors_origins: list[str] = ["http://localhost:5173"]

    # Database
    db_host: str = "localhost"
    db_port: int = 3306
    db_name: str = "whitehelmet"
    db_user: str = "whitehelmet"
    db_password: str = ""

    @property
    def database_url(self) -> str:
        return (
            f"mysql+pymysql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

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

    model_config = {"env_file": ".env", "case_sensitive": False}


@lru_cache
def get_settings() -> Settings:
    return Settings()
