# Phase 1 Multi-Tenant Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-tenant organizations, Keycloak JWT auth, and RBAC to the Whitehelmet FastAPI backend — all env-var-gated so the 4 pieces of info still pending from the client slot in without code changes.

**Architecture:** Replace cookie-session auth with Keycloak JWT Bearer validation via `python-jose`. Add `organizations` + `org_memberships` tables; scope `records` and `uploaded_files` to org. Introduce `AUTH_MODE=keycloak|local` env var so local dev keeps working without Keycloak running.

**Tech Stack:** FastAPI 0.115, SQLAlchemy 2.0, Alembic, pymysql, python-jose[cryptography], httpx

---

## File Map

### New files
| Path | Responsibility |
|------|---------------|
| `backend/app/models/organization.py` | Organization + OrgMembership SQLAlchemy models |
| `backend/app/core/keycloak.py` | JWKS fetch + JWT decode/validate |
| `backend/app/core/authorization.py` | Laravel auth service HTTP client |
| `backend/app/core/rbac.py` | FastAPI RBAC dependency functions |
| `backend/app/schemas/organization.py` | Pydantic response schemas |
| `backend/migrations/versions/XXXX_add_multi_tenant.py` | Alembic migration |

### Modified files
| Path | Change |
|------|--------|
| `backend/app/core/config.py` | Add KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID, AUTH_SERVICE_URL (exists), DB_SSL_CA, AUTH_MODE |
| `backend/app/core/dependencies.py` | Dispatch get_current_user to JWT or session based on AUTH_MODE |
| `backend/app/db/session.py` | Add SSL connect_args for OCI MySQL |
| `backend/app/models/__init__.py` | Export Organization, OrgMembership |
| `backend/app/main.py` | Add Authorization header to CORS; import new models on startup |
| `backend/app/api/routes/auth.py` | Update /me to read from JWT in keycloak mode; gate /register on AUTH_MODE |

---

## Chunk 1: Multi-Tenant Data Model

### Task 1: Organization + OrgMembership models

**Files:**
- Create: `backend/app/models/organization.py`
- Modify: `backend/app/models/__init__.py`
- Test: `backend/tests/unit/test_organization_models.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_organization_models.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.session import Base
from app.models.organization import Organization, OrgMembership
from app.models.user import User


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(engine)


def test_create_root_org(db):
    org = Organization(external_id="pif-001", name="Public Investment Fund", slug="pif")
    db.add(org)
    db.commit()
    db.refresh(org)
    assert org.id is not None
    assert org.parent_org_id is None
    assert org.is_active is True


def test_create_child_org(db):
    root = Organization(external_id="pif-001", name="PIF", slug="pif")
    db.add(root)
    db.commit()
    child = Organization(external_id="devco-001", name="DevCo A", slug="devco-a", parent_org_id=root.id)
    db.add(child)
    db.commit()
    db.refresh(child)
    assert child.parent_org_id == root.id


def test_org_membership_unique_per_user_org(db):
    from sqlalchemy.exc import IntegrityError
    org = Organization(external_id="org-001", name="Org", slug="org")
    user = User(external_id="u-001", email="a@b.com", display_name="Alice")
    db.add_all([org, user])
    db.commit()
    m1 = OrgMembership(user_id=user.id, org_id=org.id, system_role="devco_user")
    db.add(m1)
    db.commit()
    m2 = OrgMembership(user_id=user.id, org_id=org.id, system_role="devco_admin")
    db.add(m2)
    with pytest.raises(IntegrityError):
        db.commit()


def test_org_membership_valid_roles(db):
    org = Organization(external_id="org-002", name="Org2", slug="org2")
    user = User(external_id="u-002", email="b@c.com", display_name="Bob")
    db.add_all([org, user])
    db.commit()
    for role in ("pif_admin", "devco_admin", "devco_user"):
        m = OrgMembership(user_id=user.id, org_id=org.id, system_role=role)
        db.add(m)
        db.commit()
        db.delete(m)
        db.commit()
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend && python -m pytest tests/unit/test_organization_models.py -v
```
Expected: `ImportError: cannot import name 'Organization'`

- [ ] **Step 3: Create organization.py**

```python
# backend/app/models/organization.py
"""Organization and OrgMembership models — multi-tenant foundation."""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint, func

from app.db.session import Base

VALID_SYSTEM_ROLES = {"pif_admin", "devco_admin", "devco_user"}


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    external_id = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    parent_org_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class OrgMembership(Base):
    __tablename__ = "org_memberships"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    # pif_admin | devco_admin | devco_user
    system_role = Column(String(50), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "org_id", name="uq_user_org"),)
```

- [ ] **Step 4: Update `backend/app/models/__init__.py`**

Add to existing exports:
```python
from app.models.organization import Organization, OrgMembership  # noqa: F401
```

- [ ] **Step 5: Run tests to confirm pass**

```bash
cd backend && python -m pytest tests/unit/test_organization_models.py -v
```
Expected: 4 PASSED

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/organization.py backend/app/models/__init__.py backend/tests/unit/test_organization_models.py
git commit -m "feat: add Organization and OrgMembership models"
```

---

### Task 2: Alembic migration — multi-tenant schema

**Files:**
- Create: `backend/migrations/versions/XXXX_add_multi_tenant.py` (generate via Alembic)

- [ ] **Step 1: Generate migration**

```bash
cd backend && alembic revision --autogenerate -m "add_multi_tenant"
```

This will create a new file in `migrations/versions/`. Open it and verify it contains:
- `CREATE TABLE organizations` with all columns
- `CREATE TABLE org_memberships` with unique constraint
- `ALTER TABLE records ADD COLUMN org_id` (nullable FK)
- `ALTER TABLE uploaded_files ADD COLUMN org_id` (nullable FK)

**If the autogenerate misses the records/uploaded_files columns** (because the models don't have org_id yet), add them manually first — see Step 2.

- [ ] **Step 2: Add org_id to Record and UploadedFile models**

In `backend/app/models/record.py`, add after `user_id`:
```python
org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
```

In `backend/app/models/uploaded_file.py`, add after `user_id`:
```python
org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
```

- [ ] **Step 3: Re-run autogenerate (or edit migration manually)**

```bash
cd backend && alembic revision --autogenerate -m "add_multi_tenant"
```

Open the generated file and verify it includes all 4 operations listed above.

- [ ] **Step 4: Apply migration to local SQLite (test)**

```bash
cd backend && DATABASE_URL="sqlite:///test_migration.db" alembic upgrade head
```
Expected: `Running upgrade ... -> XXXX, add_multi_tenant`

Clean up: `rm test_migration.db`

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/record.py backend/app/models/uploaded_file.py backend/migrations/
git commit -m "feat: add org_id to records/uploaded_files, create multi-tenant migration"
```

---

## Chunk 2: OCI MySQL Config + Keycloak JWT Auth

### Task 3: Config settings for Keycloak and OCI MySQL SSL

**Files:**
- Modify: `backend/app/core/config.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_config.py  (add to existing or create)
def test_keycloak_settings_have_defaults():
    from app.core.config import Settings
    s = Settings(
        keycloak_url="https://auth.example.com",
        keycloak_realm="pif",
        auth_mode="keycloak",
    )
    assert s.keycloak_url == "https://auth.example.com"
    assert s.keycloak_realm == "pif"
    assert s.auth_mode == "keycloak"
    assert s.db_ssl_ca == ""  # default empty = SSL disabled


def test_auth_mode_default_is_local():
    from app.core.config import Settings
    s = Settings()
    assert s.auth_mode == "local"
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd backend && python -m pytest tests/unit/test_config.py -v -k "keycloak"
```
Expected: `ValidationError` or `AttributeError`

- [ ] **Step 3: Update config.py**

Replace `# Auth` section:
```python
# Auth
auth_service_url: str = ""      # Laravel authorization service base URL
session_secret: str = ""
csrf_secret: str = ""
session_expiry_hours: int = 24

# Keycloak (required when auth_mode=keycloak)
auth_mode: str = "local"        # "local" | "keycloak"
keycloak_url: str = ""          # e.g. https://auth.client.com
keycloak_realm: str = ""        # e.g. pif
keycloak_client_id: str = "whitehelmet"

# OCI MySQL SSL (optional — leave empty to disable SSL)
db_ssl_ca: str = ""             # path to CA cert file, e.g. /etc/ssl/mysql-ca.pem
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
cd backend && python -m pytest tests/unit/test_config.py -v -k "keycloak or auth_mode"
```
Expected: PASSED

- [ ] **Step 5: Add SSL connect_args to db/session.py**

Replace the `create_engine` call:
```python
import ssl as _ssl

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
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/core/config.py backend/app/db/session.py backend/tests/unit/test_config.py
git commit -m "feat: add Keycloak + OCI MySQL SSL config settings"
```

---

### Task 4: Keycloak JWT validation module

**Files:**
- Create: `backend/app/core/keycloak.py`
- Test: `backend/tests/unit/test_keycloak.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/unit/test_keycloak.py
import json
import time
import pytest
from unittest.mock import patch, MagicMock
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend
from jose import jwt, jwk


# --- Helpers ---

def make_rsa_key_pair():
    private_key = rsa.generate_private_key(
        public_exponent=65537, key_size=2048, backend=default_backend()
    )
    return private_key, private_key.public_key()


def make_token(claims: dict, private_key, algorithm="RS256") -> str:
    return jwt.encode(claims, private_key, algorithm=algorithm)


def make_jwks(public_key) -> dict:
    """Convert RSA public key to JWKS format."""
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
    pub_bytes = public_key.public_bytes(Encoding.PEM, PublicFormat.SubjectPublicKeyInfo)
    key_dict = jwk.construct(pub_bytes, algorithm="RS256").to_dict()
    key_dict["kid"] = "test-key-1"
    key_dict["use"] = "sig"
    key_dict["alg"] = "RS256"
    return {"keys": [key_dict]}


# --- Tests ---

def test_decode_valid_token():
    from app.core.keycloak import decode_token
    private_key, public_key = make_rsa_key_pair()
    jwks = make_jwks(public_key)
    claims = {
        "sub": "user-123",
        "email": "alice@pif.gov.sa",
        "preferred_username": "alice",
        "realm_access": {"roles": ["Org_Super_Admin"]},
        "exp": int(time.time()) + 3600,
        "iss": "https://auth.example.com/realms/pif",
        "aud": "whitehelmet",
    }
    token = make_token(claims, private_key)
    with patch("app.core.keycloak._fetch_jwks", return_value=jwks):
        decoded = decode_token(token, issuer="https://auth.example.com/realms/pif", audience="whitehelmet")
    assert decoded["sub"] == "user-123"
    assert decoded["email"] == "alice@pif.gov.sa"


def test_decode_expired_token():
    from app.core.keycloak import decode_token, TokenError
    private_key, public_key = make_rsa_key_pair()
    jwks = make_jwks(public_key)
    claims = {
        "sub": "user-123",
        "exp": int(time.time()) - 60,  # expired
        "iss": "https://auth.example.com/realms/pif",
        "aud": "whitehelmet",
    }
    token = make_token(claims, private_key)
    with patch("app.core.keycloak._fetch_jwks", return_value=jwks):
        with pytest.raises(TokenError, match="expired"):
            decode_token(token, issuer="https://auth.example.com/realms/pif", audience="whitehelmet")


def test_decode_wrong_signature():
    from app.core.keycloak import decode_token, TokenError
    private_key1, _ = make_rsa_key_pair()
    _, public_key2 = make_rsa_key_pair()  # different key pair
    jwks = make_jwks(public_key2)
    claims = {"sub": "user-123", "exp": int(time.time()) + 3600, "iss": "https://auth.example.com/realms/pif", "aud": "whitehelmet"}
    token = make_token(claims, private_key1)
    with patch("app.core.keycloak._fetch_jwks", return_value=jwks):
        with pytest.raises(TokenError):
            decode_token(token, issuer="https://auth.example.com/realms/pif", audience="whitehelmet")


def test_extract_roles():
    from app.core.keycloak import extract_roles
    claims = {"realm_access": {"roles": ["Org_Super_Admin", "offline_access", "uma_authorization"]}}
    roles = extract_roles(claims)
    assert "Org_Super_Admin" in roles
    assert "offline_access" not in roles  # internal Keycloak roles filtered out


def test_map_role_to_system_role():
    from app.core.keycloak import map_system_role
    assert map_system_role(["Org_Super_Admin"]) == "pif_admin"
    assert map_system_role(["Org_Admin"]) == "devco_admin"
    assert map_system_role(["Org_Member"]) == "devco_user"
    assert map_system_role(["unknown_role"]) is None
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && python -m pytest tests/unit/test_keycloak.py -v
```
Expected: `ImportError: cannot import name 'decode_token'`

- [ ] **Step 3: Create keycloak.py**

```python
# backend/app/core/keycloak.py
"""Keycloak JWT validation — fetch JWKS, decode tokens, extract roles."""

import time
import httpx
from jose import jwt, JWTError
from typing import Optional


# Role mapping: Keycloak realm roles → our system roles
_ROLE_MAP = {
    "Org_Super_Admin": "pif_admin",
    "Org_Admin": "devco_admin",
    "Org_Member": "devco_user",
}

# Internal Keycloak roles to ignore when extracting app roles
_INTERNAL_ROLES = {"offline_access", "uma_authorization", "default-roles-pif"}

# In-memory JWKS cache: {url: (jwks_dict, fetched_at)}
_jwks_cache: dict[str, tuple[dict, float]] = {}
_JWKS_TTL = 3600  # re-fetch keys every hour


class TokenError(Exception):
    """Raised when JWT validation fails."""


def _fetch_jwks(jwks_url: str) -> dict:
    """Fetch JWKS from Keycloak, with 1h in-memory cache."""
    cached = _jwks_cache.get(jwks_url)
    if cached and (time.time() - cached[1]) < _JWKS_TTL:
        return cached[0]
    response = httpx.get(jwks_url, timeout=5.0)
    response.raise_for_status()
    jwks = response.json()
    _jwks_cache[jwks_url] = (jwks, time.time())
    return jwks


def decode_token(token: str, *, issuer: str, audience: str, jwks_url: Optional[str] = None) -> dict:
    """Validate and decode a Keycloak JWT. Raises TokenError on any failure."""
    if jwks_url is None:
        # Derive JWKS URL from issuer: {issuer}/protocol/openid-connect/certs
        jwks_url = f"{issuer}/protocol/openid-connect/certs"

    try:
        jwks = _fetch_jwks(jwks_url)
        # python-jose can accept a JWKS dict directly
        claims = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            audience=audience,
            issuer=issuer,
        )
        return claims
    except JWTError as e:
        msg = str(e).lower()
        if "expired" in msg:
            raise TokenError("Token expired") from e
        raise TokenError(f"Invalid token: {e}") from e
    except httpx.HTTPError as e:
        raise TokenError(f"Could not fetch JWKS: {e}") from e


def extract_roles(claims: dict) -> list[str]:
    """Extract app-relevant realm roles from JWT claims, filtering internal ones."""
    realm_roles = claims.get("realm_access", {}).get("roles", [])
    return [r for r in realm_roles if r not in _INTERNAL_ROLES]


def map_system_role(roles: list[str]) -> Optional[str]:
    """Map Keycloak realm roles to our system role. Returns highest-privilege match."""
    priority = ["pif_admin", "devco_admin", "devco_user"]
    mapped = {_ROLE_MAP[r] for r in roles if r in _ROLE_MAP}
    for role in priority:
        if role in mapped:
            return role
    return None
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
cd backend && python -m pytest tests/unit/test_keycloak.py -v
```
Expected: 5 PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/keycloak.py backend/tests/unit/test_keycloak.py
git commit -m "feat: Keycloak JWT validation module"
```

---

### Task 5: Laravel Authorization service client

**Files:**
- Create: `backend/app/core/authorization.py`
- Test: `backend/tests/unit/test_authorization.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/unit/test_authorization.py
import pytest
from unittest.mock import patch, AsyncMock
import httpx


def test_check_org_access_allowed():
    from app.core.authorization import check_org_access
    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"has_access": True}

    with patch("app.core.authorization._client") as mock_client:
        mock_client.post = AsyncMock(return_value=mock_response)
        import asyncio
        result = asyncio.get_event_loop().run_until_complete(
            check_org_access(user_external_id="u-123", org_external_id="pif-001", service_url="https://auth.example.com")
        )
    assert result is True


def test_check_org_access_denied():
    from app.core.authorization import check_org_access
    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"has_access": False}

    with patch("app.core.authorization._client") as mock_client:
        mock_client.post = AsyncMock(return_value=mock_response)
        import asyncio
        result = asyncio.get_event_loop().run_until_complete(
            check_org_access(user_external_id="u-123", org_external_id="pif-001", service_url="https://auth.example.com")
        )
    assert result is False


def test_check_org_access_service_unavailable_fails_closed():
    """If auth service is unreachable, deny access (fail closed)."""
    from app.core.authorization import check_org_access

    with patch("app.core.authorization._client") as mock_client:
        mock_client.post = AsyncMock(side_effect=httpx.ConnectError("unreachable"))
        import asyncio
        result = asyncio.get_event_loop().run_until_complete(
            check_org_access(user_external_id="u-123", org_external_id="pif-001", service_url="https://auth.example.com")
        )
    assert result is False


def test_check_org_access_skipped_when_no_service_url():
    """When AUTH_SERVICE_URL is empty (local dev), skip check and return True."""
    from app.core.authorization import check_org_access
    import asyncio
    result = asyncio.get_event_loop().run_until_complete(
        check_org_access(user_external_id="u-123", org_external_id="pif-001", service_url="")
    )
    assert result is True
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && python -m pytest tests/unit/test_authorization.py -v
```
Expected: `ImportError`

- [ ] **Step 3: Create authorization.py**

```python
# backend/app/core/authorization.py
"""Laravel Authorization service client — checks if a user's org has access to this app."""

import httpx

_client = httpx.AsyncClient(timeout=5.0)
_APP_ID = "whitehelmet"


async def check_org_access(
    *,
    user_external_id: str,
    org_external_id: str,
    service_url: str,
) -> bool:
    """Return True if the user's org has access to this app.

    Returns True without calling the service if service_url is empty (local dev mode).
    Returns False (fail closed) if the service is unreachable.
    """
    if not service_url:
        return True  # local dev — skip check

    try:
        response = await _client.post(
            f"{service_url}/check-access",
            json={
                "user_id": user_external_id,
                "org_id": org_external_id,
                "app_id": _APP_ID,
            },
            headers={"Content-Type": "application/json"},
        )
        data = response.json()
        return bool(data.get("has_access", False))
    except (httpx.HTTPError, Exception):
        return False  # fail closed — deny on any error
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
cd backend && python -m pytest tests/unit/test_authorization.py -v
```
Expected: 4 PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/authorization.py backend/tests/unit/test_authorization.py
git commit -m "feat: Laravel authorization service client"
```

---

### Task 6: RBAC dependency functions

**Files:**
- Create: `backend/app/core/rbac.py`
- Test: `backend/tests/unit/test_rbac.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/unit/test_rbac.py
import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException


def _make_user(role: str):
    """Create a mock user dict as returned by get_current_user in keycloak mode."""
    return {"external_id": "u-123", "email": "a@b.com", "system_role": role, "org_external_id": "org-001"}


def test_require_pif_admin_passes():
    from app.core.rbac import require_pif_admin
    import asyncio
    user = _make_user("pif_admin")
    asyncio.get_event_loop().run_until_complete(require_pif_admin(current_user=user))


def test_require_pif_admin_denies_devco_admin():
    from app.core.rbac import require_pif_admin
    import asyncio
    user = _make_user("devco_admin")
    with pytest.raises(HTTPException) as exc_info:
        asyncio.get_event_loop().run_until_complete(require_pif_admin(current_user=user))
    assert exc_info.value.status_code == 403


def test_require_devco_admin_passes_devco_admin():
    from app.core.rbac import require_devco_admin
    import asyncio
    for role in ("pif_admin", "devco_admin"):
        user = _make_user(role)
        asyncio.get_event_loop().run_until_complete(require_devco_admin(current_user=user))


def test_require_devco_admin_denies_devco_user():
    from app.core.rbac import require_devco_admin
    import asyncio
    user = _make_user("devco_user")
    with pytest.raises(HTTPException) as exc_info:
        asyncio.get_event_loop().run_until_complete(require_devco_admin(current_user=user))
    assert exc_info.value.status_code == 403


def test_require_org_member_passes_any_role():
    from app.core.rbac import require_org_member
    import asyncio
    for role in ("pif_admin", "devco_admin", "devco_user"):
        user = _make_user(role)
        asyncio.get_event_loop().run_until_complete(require_org_member(current_user=user))


def test_require_org_member_denies_no_role():
    from app.core.rbac import require_org_member
    import asyncio
    user = {"external_id": "u-123", "email": "a@b.com", "system_role": None, "org_external_id": "org-001"}
    with pytest.raises(HTTPException) as exc_info:
        asyncio.get_event_loop().run_until_complete(require_org_member(current_user=user))
    assert exc_info.value.status_code == 403
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && python -m pytest tests/unit/test_rbac.py -v
```
Expected: `ImportError`

- [ ] **Step 3: Create rbac.py**

```python
# backend/app/core/rbac.py
"""FastAPI RBAC dependencies — role-based access control."""

from fastapi import Depends, HTTPException, status
from app.core.dependencies import get_current_user

# Role hierarchy: higher index = more privilege
_ROLE_RANK = {"devco_user": 0, "devco_admin": 1, "pif_admin": 2}


def _check_role(current_user: dict, min_role: str) -> None:
    user_role = current_user.get("system_role")
    if user_role is None or _ROLE_RANK.get(user_role, -1) < _ROLE_RANK[min_role]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires {min_role} or higher",
        )


async def require_pif_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Only pif_admin can access this route."""
    _check_role(current_user, "pif_admin")
    return current_user


async def require_devco_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """devco_admin or pif_admin can access this route."""
    _check_role(current_user, "devco_admin")
    return current_user


async def require_org_member(current_user: dict = Depends(get_current_user)) -> dict:
    """Any authenticated org member can access this route."""
    _check_role(current_user, "devco_user")
    return current_user
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
cd backend && python -m pytest tests/unit/test_rbac.py -v
```
Expected: 6 PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/rbac.py backend/tests/unit/test_rbac.py
git commit -m "feat: RBAC dependency functions"
```

---

## Chunk 3: Auth Middleware Wiring

### Task 7: Update dependencies.py — JWT mode + local fallback

The existing `get_current_user` reads from an httpOnly session cookie. We need it to dispatch to Keycloak JWT validation when `AUTH_MODE=keycloak`, and fall back to the existing session cookie path when `AUTH_MODE=local`.

**Files:**
- Modify: `backend/app/core/dependencies.py`
- Test: `backend/tests/unit/test_dependencies.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/unit/test_dependencies.py
import pytest
import time
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi import HTTPException


def _mock_request(bearer_token: str = None, cookie_token: str = None):
    req = MagicMock()
    headers = {}
    if bearer_token:
        headers["authorization"] = f"Bearer {bearer_token}"
    req.headers = headers
    req.cookies = {"session_id": cookie_token} if cookie_token else {}
    return req


def test_keycloak_mode_valid_token(monkeypatch):
    import asyncio
    from app.core import dependencies

    monkeypatch.setenv("AUTH_MODE", "keycloak")
    monkeypatch.setenv("KEYCLOAK_URL", "https://auth.example.com")
    monkeypatch.setenv("KEYCLOAK_REALM", "pif")
    monkeypatch.setenv("KEYCLOAK_CLIENT_ID", "whitehelmet")
    monkeypatch.setenv("AUTH_SERVICE_URL", "")

    mock_claims = {
        "sub": "user-abc",
        "email": "alice@pif.gov.sa",
        "preferred_username": "alice",
        "realm_access": {"roles": ["Org_Super_Admin"]},
    }

    with patch("app.core.dependencies.decode_token", return_value=mock_claims), \
         patch("app.core.dependencies.check_org_access", new_callable=AsyncMock, return_value=True):
        req = _mock_request(bearer_token="valid.jwt.token")
        result = asyncio.get_event_loop().run_until_complete(
            dependencies._get_current_user_keycloak(req)
        )
    assert result["external_id"] == "user-abc"
    assert result["email"] == "alice@pif.gov.sa"
    assert result["system_role"] == "pif_admin"


def test_keycloak_mode_missing_token():
    import asyncio
    from app.core.dependencies import _get_current_user_keycloak
    req = _mock_request()  # no token
    with pytest.raises(HTTPException) as exc_info:
        asyncio.get_event_loop().run_until_complete(_get_current_user_keycloak(req))
    assert exc_info.value.status_code == 401


def test_keycloak_mode_org_access_denied(monkeypatch):
    import asyncio
    from app.core import dependencies

    mock_claims = {
        "sub": "user-abc",
        "email": "x@x.com",
        "preferred_username": "x",
        "realm_access": {"roles": ["Org_Member"]},
    }

    with patch("app.core.dependencies.decode_token", return_value=mock_claims), \
         patch("app.core.dependencies.check_org_access", new_callable=AsyncMock, return_value=False):
        req = _mock_request(bearer_token="valid.jwt.token")
        with pytest.raises(HTTPException) as exc_info:
            asyncio.get_event_loop().run_until_complete(
                dependencies._get_current_user_keycloak(req)
            )
    assert exc_info.value.status_code == 403
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd backend && python -m pytest tests/unit/test_dependencies.py -v
```
Expected: `ImportError: cannot import name '_get_current_user_keycloak'`

- [ ] **Step 3: Rewrite dependencies.py**

```python
# backend/app/core/dependencies.py
"""FastAPI dependencies for auth, DB sessions, rate limiting."""

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.config import get_settings


# --- Keycloak JWT path ---

def decode_token(token: str, **kwargs):
    """Thin wrapper imported separately so tests can patch it."""
    from app.core.keycloak import decode_token as _decode
    return _decode(token, **kwargs)


async def check_org_access(**kwargs) -> bool:
    """Thin wrapper imported separately so tests can patch it."""
    from app.core.authorization import check_org_access as _check
    return await _check(**kwargs)


async def _get_current_user_keycloak(request: Request) -> dict:
    """Extract and validate Keycloak Bearer JWT; check org access."""
    settings = get_settings()

    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    token = auth_header.removeprefix("Bearer ").strip()
    issuer = f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"

    try:
        claims = decode_token(token, issuer=issuer, audience=settings.keycloak_client_id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    from app.core.keycloak import extract_roles, map_system_role
    roles = extract_roles(claims)
    system_role = map_system_role(roles)

    org_external_id = claims.get("org_id", "")  # custom claim — exact key TBD with client

    has_access = await check_org_access(
        user_external_id=claims["sub"],
        org_external_id=org_external_id,
        service_url=settings.auth_service_url,
    )
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Org does not have access")

    return {
        "external_id": claims["sub"],
        "email": claims.get("email", ""),
        "display_name": claims.get("preferred_username", ""),
        "system_role": system_role,
        "org_external_id": org_external_id,
    }


# --- Local session path (existing) ---

async def _get_current_user_local(request: Request, db: Session = Depends(get_db)):
    """Existing cookie-session auth — used in local dev (AUTH_MODE=local)."""
    from app.models.session import SessionModel
    from app.models.user import User
    from datetime import datetime, timezone

    session_token = request.cookies.get("session_id")
    if not session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    session = (
        db.query(SessionModel)
        .filter(
            SessionModel.token == session_token,
            SessionModel.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired or invalid")

    user = db.query(User).filter(User.id == session.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Return same shape as keycloak mode so routes are auth-mode-agnostic
    return {
        "external_id": user.external_id,
        "email": user.email,
        "display_name": user.display_name,
        "system_role": None,      # no roles in local mode
        "org_external_id": None,
        "_db_user": user,         # local mode only — routes that need DB user object
    }


# --- Public dispatcher ---

async def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    """Dispatch to keycloak or local auth based on AUTH_MODE setting."""
    settings = get_settings()
    if settings.auth_mode == "keycloak":
        return await _get_current_user_keycloak(request)
    return await _get_current_user_local(request, db)


async def verify_csrf(request: Request) -> None:
    """Verify CSRF token on state-mutating requests (local mode only)."""
    settings = get_settings()
    if settings.auth_mode == "keycloak":
        return  # CSRF not needed with Bearer tokens

    if request.method in ("GET", "HEAD", "OPTIONS"):
        return

    from app.core.security import verify_csrf_token

    session_token = request.cookies.get("session_id")
    csrf_token = request.headers.get("X-CSRF-Token")

    if not session_token or not csrf_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed")

    if not verify_csrf_token(session_token, csrf_token):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF token mismatch")
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
cd backend && python -m pytest tests/unit/test_dependencies.py -v
```
Expected: 3 PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/dependencies.py backend/tests/unit/test_dependencies.py
git commit -m "feat: JWT auth middleware with AUTH_MODE dispatch"
```

---

### Task 8: Update main.py and auth routes

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/app/api/routes/auth.py`

- [ ] **Step 1: Update main.py CORS headers**

Add `Authorization` to allowed headers (needed for Bearer token):
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "X-CSRF-Token", "Authorization"],  # ← added Authorization
)
```

Update startup to import new models:
```python
from app.models import User, Record, UploadedFile, ConversationMessage, SessionModel  # noqa: F401
from app.models.organization import Organization, OrgMembership  # noqa: F401
```

- [ ] **Step 2: Update /api/auth/me to return JWT claims in keycloak mode**

In `backend/app/api/routes/auth.py`, update the `/me` route:

```python
@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    """Return current user info. Works in both auth modes."""
    return {
        "external_id": current_user.get("external_id"),
        "email": current_user.get("email"),
        "display_name": current_user.get("display_name"),
        "system_role": current_user.get("system_role"),
        "org_external_id": current_user.get("org_external_id"),
    }
```

Gate `/register` and `/login` on AUTH_MODE:
```python
from app.core.config import get_settings as _get_settings

@router.post("/register")
async def register(...):
    if _get_settings().auth_mode == "keycloak":
        raise HTTPException(status_code=404, detail="Not available in SSO mode")
    # ... existing implementation
```

- [ ] **Step 3: Run full test suite**

```bash
cd backend && python -m pytest tests/ -v --tb=short
```
Expected: All tests pass (or pre-existing failures only — do not introduce new failures)

- [ ] **Step 4: Commit**

```bash
git add backend/app/main.py backend/app/api/routes/auth.py
git commit -m "feat: wire JWT auth, gate register/login on AUTH_MODE"
```

---

### Task 9: Frontend auth redirect

When `AUTH_MODE=keycloak`, unauthenticated users should be redirected to the Keycloak login page. This is a frontend concern.

**Files:**
- Modify: `index.html` (or `frontend/src/` if Vue frontend is the target)

Since the production app is Vue 3 (`frontend/`), add a lightweight auth guard. The legacy `index.html` MVP gets the same treatment.

- [ ] **Step 1: Add env var for Keycloak login URL**

In `backend/app/core/config.py`, add:
```python
keycloak_login_url: str = ""  # Full redirect URL to CS Dashboard login — provided by client
```

- [ ] **Step 2: Add a /api/auth/config endpoint (no auth required)**

In `backend/app/api/routes/auth.py`, add:
```python
@router.get("/config")
async def auth_config():
    """Return auth configuration for frontend — public, no auth required."""
    settings = get_settings()
    return {
        "auth_mode": settings.auth_mode,
        "login_url": settings.keycloak_login_url,
    }
```

- [ ] **Step 3: Add redirect logic to legacy index.html**

At the top of the `<script>` in `index.html`, add before any authenticated calls:
```javascript
// Auth guard — redirect to Keycloak if not authenticated
async function checkAuth() {
  const res = await fetch('/api/auth/config');
  const config = await res.json();
  if (config.auth_mode === 'keycloak') {
    // In keycloak mode, token arrives via URL param or cookie set by CS Dashboard
    const urlToken = new URLSearchParams(window.location.search).get('token');
    if (urlToken) {
      // Store for use in API calls
      sessionStorage.setItem('bearer_token', urlToken);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (!sessionStorage.getItem('bearer_token')) {
      window.location.href = config.login_url + '?redirect_uri=' + encodeURIComponent(window.location.href);
      return false;
    }
  }
  return true;
}
```

Note: The exact mechanism for how the CS Dashboard passes the token (URL param, cookie, fragment) is still TBD. This implementation assumes URL param `?token=...`. Update when confirmed with client.

- [ ] **Step 4: Commit**

```bash
git add backend/app/core/config.py backend/app/api/routes/auth.py index.html
git commit -m "feat: frontend auth redirect + /api/auth/config endpoint"
```

---

## Final Check

- [ ] **Run full backend test suite**

```bash
cd backend && python -m pytest tests/ -v --cov=app --cov-report=term-missing
```
Expected: ≥80% coverage, no failures

- [ ] **Verify all new env vars are documented**

Add to `backend/.env.example` (or create it):
```bash
# Auth
AUTH_MODE=local                         # "local" | "keycloak"
KEYCLOAK_URL=                           # e.g. https://auth.client.com  [PENDING]
KEYCLOAK_REALM=                         # e.g. pif  [PENDING]
KEYCLOAK_CLIENT_ID=whitehelmet
KEYCLOAK_LOGIN_URL=                     # CS Dashboard login URL  [PENDING]
AUTH_SERVICE_URL=                       # Laravel auth service base URL  [PENDING]

# OCI MySQL (dev)
DATABASE_URL=mysql+pymysql://user:pass@10.32.10.184:3306/whitehelmet
DB_SSL_CA=                              # Path to CA cert, e.g. /etc/ssl/mysql-ca.pem
```

- [ ] **Final commit**

```bash
git add backend/.env.example
git commit -m "docs: add .env.example with all Phase 1 env vars"
```

---

## Open Questions

1. **[BLOCKED — wait for Adel's API doc]** What JWT claim key carries `org_id`? (currently assuming `"org_id"`) — API doc will show sample JWT payload
2. **[BLOCKED — wait for Adel's API doc]** How does CS Dashboard pass the token to our app? (URL param? Cookie? Fragment?) — API doc will describe the redirect/handoff flow
3. What endpoint path does the Laravel auth service expose? (currently assuming `/check-access`) — API doc will cover this
4. ~~Should `records` and `uploaded_files` org_id be enforced at DB level (NOT NULL) or application level only?~~ **RESOLVED: NOT NULL — starting fresh, no existing data to migrate**

> **Note:** Tasks 7 (dependencies.py JWT middleware) and 9 (frontend redirect) are blocked on Q1 and Q2. All other tasks can be built now. Do not implement those two tasks until Adel's API doc arrives.
