"""Shared test fixtures."""

import os

# Set environment to 'test' BEFORE importing app — prevents startup event
# from connecting to MySQL (it only creates tables when environment == 'dev')
os.environ["ENVIRONMENT"] = "test"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, String
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy import BigInteger
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.compiler import compiles

from app.db.session import Base, get_db


# Make PostgreSQL UUID compile as VARCHAR in SQLite test engine
@compiles(PG_UUID, "sqlite")
def compile_uuid_sqlite(type_, compiler, **kw):
    return "VARCHAR(36)"


# Make BigInteger compile as INTEGER in SQLite so autoincrement/RETURNING works
@compiles(BigInteger, "sqlite")
def compile_bigint_sqlite(type_, compiler, **kw):
    return "INTEGER"
from app.main import app
from app.core.config import Settings, get_settings
from app.models.profile import Profile
from app.models.template import Template
from app.models.template_version import TemplateVersion
from app.models.template_assignment import TemplateAssignment
from app.models.submission import Submission
from app.models.consolidated_sheet import ConsolidatedSheet

# In-memory SQLite for tests
TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)


@pytest.fixture(autouse=True)
def setup_db():
    """Create all tables before each test, drop after."""
    Base.metadata.create_all(bind=TEST_ENGINE)
    yield
    Base.metadata.drop_all(bind=TEST_ENGINE)


@pytest.fixture
def db():
    """Provide a test DB session."""
    session = TestSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    """Test client with DB override."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db):
    """Create a test profile."""
    import uuid
    user = Profile(id=str(uuid.uuid4()), role="org_member", display_name="Test User")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_client(client, db, test_user):
    """Test client with authenticated Bearer token (mocks JWT validation)."""
    from app.core.dependencies import get_current_user

    async def override_get_current_user():
        return test_user

    client.app.dependency_overrides[get_current_user] = override_get_current_user
    yield client
    client.app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def pif_admin_user(db):
    """Create a pif_admin test profile."""
    import uuid
    user = Profile(id=str(uuid.uuid4()), role="org_super_admin", display_name="PIF Admin")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def pif_admin_client(client, db, pif_admin_user):
    """Test client authenticated as pif_admin."""
    from app.core.dependencies import get_current_user

    async def override_get_current_user():
        return pif_admin_user

    client.app.dependency_overrides[get_current_user] = override_get_current_user
    yield client
    client.app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def settings_override(tmp_path):
    """Settings with empty API keys and tmp upload dir."""
    s = Settings(
        anthropic_api_key="",
        openrouter_api_key="",
        upload_dir=str(tmp_path / "uploads"),
        max_upload_size_mb=50,
        session_secret="test-secret",
        csrf_secret="test-csrf-secret",
        db_password="",
    )
    app.dependency_overrides[get_settings] = lambda: s
    yield s
    app.dependency_overrides.pop(get_settings, None)
