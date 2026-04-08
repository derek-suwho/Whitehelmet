"""Shared test fixtures."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base, get_db
from app.main import app
from app.models.user import User
from app.models.session import SessionModel
from app.core.security import generate_session_token, session_expiry

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
    """Create a test user."""
    user = User(external_id="test-ext-1", email="test@whitehelmet.com", display_name="Test User")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_client(client, db, test_user):
    """Test client with authenticated session."""
    token = generate_session_token()
    session = SessionModel(token=token, user_id=test_user.id, expires_at=session_expiry())
    db.add(session)
    db.commit()

    client.cookies.set("session_id", token)
    # Set CSRF token header for state-mutating requests
    from app.core.security import generate_csrf_token
    csrf = generate_csrf_token(token)
    client.headers["X-CSRF-Token"] = csrf
    return client
