# Supabase Source of Truth Migration Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Supabase PostgreSQL the single schema authority — migrate all SQLAlchemy models to match Supabase DDL, write migrations for all missing tables, and replace cookie-session auth with Supabase JWT Bearer validation.

**Architecture:** All DDL lives in `supabase/migrations/`; SQLAlchemy models are kept purely as ORM wrappers that reflect the PostgreSQL schema. Auth becomes stateless: Bearer token (Supabase JWT, ES256-signed) → validate via Supabase JWKS endpoint → look up `profiles` row → return profile to request handler. The custom `sessions` table is retired. Supabase's current signing key is ECC (P-256) / ES256 — the legacy HS256 shared secret is no longer used for new tokens.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, psycopg2-binary (already installed), python-jose (already installed), Supabase PostgreSQL

---

## Chunk 1: Schema — Supabase Migrations

### Task 1: Write migration for backend-only tables

**Files:**
- Create: `supabase/migrations/20260505000001_backend_tables.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260505000001_backend_tables.sql
-- Backend-owned tables that have no prior Supabase DDL.
-- Sessions table is intentionally omitted — auth uses Supabase JWTs (stateless).

-- records — user-scoped consolidation results
create table if not exists public.records (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  org_id uuid,
  name text not null,
  source_count integer not null default 0,
  row_count integer not null default 0,
  col_count integer not null default 0,
  spreadsheet_data bytea,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists records_user_id_idx on public.records(user_id);

-- uploaded_files — xlsx upload metadata
create table if not exists public.uploaded_files (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  org_id uuid,
  original_name text not null,
  stored_path text not null,
  mime_type text not null,
  size_bytes bigint not null,
  sha256 char(64) not null,
  created_at timestamptz not null default now()
);
create index if not exists uploaded_files_user_id_idx on public.uploaded_files(user_id);

-- conversation_history — chat context per record
create table if not exists public.conversation_history (
  id bigserial primary key,
  record_id bigint not null references public.records(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists conversation_history_record_id_idx on public.conversation_history(record_id);

-- projects — admin-created groups of templates + subcontractors
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'active',
  created_by uuid references public.profiles(id),
  master_template_id uuid,
  created_at timestamptz not null default now()
);

-- project_members — subcontractors assigned to a project
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now()
);
create index if not exists project_members_project_id_idx on public.project_members(project_id);
create index if not exists project_members_user_id_idx on public.project_members(user_id);

-- template_formulas — Excel formulas attached to a template version
create table if not exists public.template_formulas (
  id uuid primary key default gen_random_uuid(),
  template_version_id uuid not null references public.template_versions(id) on delete cascade,
  name text not null,
  target_column text not null,
  formula_type text not null default 'column' check (formula_type in ('column', 'single_cell')),
  expression text not null,
  weight double precision,
  benchmark double precision,
  scoring_rules text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists template_formulas_version_id_idx on public.template_formulas(template_version_id);

-- RLS: deny all anonymous access (backend uses service role, bypasses RLS)
alter table public.records enable row level security;
alter table public.uploaded_files enable row level security;
alter table public.conversation_history enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.template_formulas enable row level security;
```

- [ ] **Step 2: Verify SQL is valid (dry run)**

```bash
# Validate syntax using psql (adjust connection string from .env)
psql "$DATABASE_URL" --single-transaction --dry-run \
  -f supabase/migrations/20260505000001_backend_tables.sql 2>&1 | head -40
```
Expected: no errors (or `--dry-run` not supported → comment out and run in a test env)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260505000001_backend_tables.sql
git commit -m "feat: supabase migration for backend-only tables"
```

---

### Task 2: Write schema reconciliation migration

**Files:**
- Create: `supabase/migrations/20260505000002_schema_reconcile.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260505000002_schema_reconcile.sql
-- Add columns that exist in SQLAlchemy models but were missing from Supabase DDL.
-- All statements are idempotent (add column if not exists pattern).

-- templates: add template_type (subcontractor | master)
alter table public.templates
  add column if not exists template_type text not null default 'subcontractor';

-- submissions: add processed_file_path (path to formula-processed xlsx)
alter table public.submissions
  add column if not exists processed_file_path text;

-- template_assignments: add locking + per-user assignment columns
alter table public.template_assignments
  add column if not exists assigned_to_user_id uuid references public.profiles(id),
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references public.profiles(id);

-- template_versions: enforce unique version per template
-- (already in the Supabase DDL unique constraint; this is a safety check)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'template_versions_template_id_version_number_key'
      and table_name = 'template_versions'
  ) then
    alter table public.template_versions
      add constraint template_versions_template_id_version_number_key
      unique (template_id, version_number);
  end if;
end $$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260505000002_schema_reconcile.sql
git commit -m "feat: schema reconcile migration — missing columns"
```

---

## Chunk 2: Model Layer — SQLAlchemy Models

### Task 3: Replace User model with Profile model

The `users` table is gone. Identity comes from Supabase Auth; our DB has `profiles`.

**Files:**
- Create: `backend/app/models/profile.py`
- Delete content of: `backend/app/models/user.py` (replace with re-export shim)
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/unit/test_profile_model.py
import uuid
from app.models.profile import Profile

def test_profile_has_uuid_pk():
    p = Profile(id=str(uuid.uuid4()), org_id=None, role="devco_user", display_name="Alice")
    assert p.display_name == "Alice"
    assert p.role == "devco_user"

def test_profile_tablename():
    assert Profile.__tablename__ == "profiles"
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd backend && python -m pytest tests/unit/test_profile_model.py -v
```
Expected: `ModuleNotFoundError: No module named 'app.models.profile'`

- [ ] **Step 3: Create Profile model**

```python
# backend/app/models/profile.py
"""Profile model — synced from Supabase auth.users via Supabase Auth."""

import uuid
from sqlalchemy import Column, String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID

from app.db.session import Base


class Profile(Base):
    __tablename__ = "profiles"

    # id mirrors auth.users.id — set by Supabase Auth, never generated here
    id = Column(UUID(as_uuid=False), primary_key=True)
    org_id = Column(UUID(as_uuid=False), nullable=True, index=True)
    role = Column(String(50), nullable=False)      # pif_admin | devco_admin | devco_user
    display_name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
```

- [ ] **Step 4: Replace user.py with backward-compat shim**

```python
# backend/app/models/user.py
"""Backward-compat shim — User is now Profile."""
from app.models.profile import Profile as User  # noqa: F401
```

- [ ] **Step 5: Update __init__.py**

```python
# backend/app/models/__init__.py
from app.models.profile import Profile
from app.models.user import User               # shim for existing imports
from app.models.record import Record
from app.models.uploaded_file import UploadedFile
from app.models.conversation import ConversationMessage
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.template import Template
from app.models.template_version import TemplateVersion
from app.models.template_assignment import TemplateAssignment
from app.models.submission import Submission
from app.models.consolidated_sheet import ConsolidatedSheet
from app.models.formula import Formula
from app.models.template_formula import TemplateFormula
from app.models.organization import Organization

__all__ = [
    "Profile", "User",
    "Record", "UploadedFile", "ConversationMessage",
    "Project", "ProjectMember",
    "Template", "TemplateVersion", "TemplateAssignment",
    "Submission", "ConsolidatedSheet",
    "Formula", "TemplateFormula",
    "Organization",
]
```

- [ ] **Step 6: Run test — expect pass**

```bash
cd backend && python -m pytest tests/unit/test_profile_model.py -v
```
Expected: PASSED

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/profile.py backend/app/models/user.py backend/app/models/__init__.py
git commit -m "feat: Profile model replaces User; User shim for backward compat"
```

---

### Task 4: Update Formula model to match Supabase schema

**Files:**
- Modify: `backend/app/models/formula.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/unit/test_formula_model.py
import uuid
from app.models.formula import Formula

def test_formula_uuid_pk():
    f = Formula(
        id=str(uuid.uuid4()),
        created_by=str(uuid.uuid4()),
        name="Lost time rate",
        expression="=B2/A2",
        formula_type="calculation",
    )
    assert f.is_library_item is False
    assert f.usage_count == 0

def test_formula_tablename():
    assert Formula.__tablename__ == "formulas"
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd backend && python -m pytest tests/unit/test_formula_model.py -v
```
Expected: `AttributeError: 'Formula' object has no attribute 'is_library_item'`

- [ ] **Step 3: Update Formula model**

```python
# backend/app/models/formula.py
"""Formula library — PIF-owned reusable calculation formulas."""

import uuid
from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime, func
from sqlalchemy.dialects.postgresql import UUID

from app.db.session import Base


class Formula(Base):
    __tablename__ = "formulas"

    id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    nl_prompt = Column(Text, nullable=True)
    expression = Column(Text, nullable=False)
    formula_type = Column(String(50), nullable=False)
    is_library_item = Column(Boolean, nullable=False, default=False)
    created_by = Column(UUID(as_uuid=False), nullable=True, index=True)
    usage_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
```

- [ ] **Step 4: Run test — expect pass**

```bash
cd backend && python -m pytest tests/unit/test_formula_model.py -v
```
Expected: PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/formula.py
git commit -m "feat: Formula model — UUID PK, created_by, is_library_item, usage_count"
```

---

### Task 5: Update Record, UploadedFile — user_id Integer → UUID

**Files:**
- Modify: `backend/app/models/record.py`
- Modify: `backend/app/models/uploaded_file.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/unit/test_record_model.py
import uuid
from app.models.record import Record

def test_record_user_id_is_string():
    r = Record(user_id=str(uuid.uuid4()), name="Q1 Report", source_count=3)
    assert isinstance(r.user_id, str)
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd backend && python -m pytest tests/unit/test_record_model.py -v
```
Expected: PASSED (it's a string in both — but FK type changes)

- [ ] **Step 3: Update Record model**

```python
# backend/app/models/record.py
"""Master record model — persisted consolidation results."""

from sqlalchemy import Column, BigInteger, String, Integer, DateTime, LargeBinary, func
from sqlalchemy.dialects.postgresql import UUID

from app.db.session import Base


class Record(Base):
    __tablename__ = "records"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=False), nullable=False, index=True)
    org_id = Column(UUID(as_uuid=False), nullable=True, index=True)
    name = Column(String(500), nullable=False)
    source_count = Column(Integer, nullable=False, default=0)
    row_count = Column(Integer, nullable=False, default=0)
    col_count = Column(Integer, nullable=False, default=0)
    spreadsheet_data = Column(LargeBinary, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
```

- [ ] **Step 4: Update UploadedFile model**

```python
# backend/app/models/uploaded_file.py
"""Uploaded file metadata — tracks xlsx uploads with integrity checksums."""

from sqlalchemy import Column, BigInteger, String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID

from app.db.session import Base


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=False), nullable=False, index=True)
    org_id = Column(UUID(as_uuid=False), nullable=True, index=True)
    original_name = Column(String(500), nullable=False)
    stored_path = Column(String(1000), nullable=False)
    mime_type = Column(String(100), nullable=False)
    size_bytes = Column(BigInteger, nullable=False)
    sha256 = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/record.py backend/app/models/uploaded_file.py
git commit -m "feat: Record + UploadedFile — UUID user_id, BigInteger PK, timezone-aware datetime"
```

---

### Task 6: Fix remaining models — Organization, TemplateVersion, ConversationMessage, misc

**Files:**
- Modify: `backend/app/models/organization.py`
- Modify: `backend/app/models/template_version.py`
- Modify: `backend/app/models/conversation.py`
- Modify: `backend/app/models/project_member.py`
- Modify: `backend/app/models/template_formula.py`
- Delete: `backend/app/models/session.py` (replaced by Supabase JWTs)

- [ ] **Step 1: Update Organization (add UniqueConstraint/FK notes)**

```python
# backend/app/models/organization.py
"""Organization model — PIF (root) and DevCo (member) tenants."""

import uuid
from sqlalchemy import Column, String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID

from app.db.session import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    type = Column(String(10), nullable=False)       # pif | devco
    parent_org_id = Column(UUID(as_uuid=False), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
```

- [ ] **Step 2: Update TemplateVersion (add UniqueConstraint)**

```python
# backend/app/models/template_version.py
"""TemplateVersion — immutable snapshots of a template's column schema."""

import uuid
from sqlalchemy import Column, String, Integer, DateTime, Text, func, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.db.session import Base


class TemplateVersion(Base):
    __tablename__ = "template_versions"
    __table_args__ = (UniqueConstraint("template_id", "version_number"),)

    id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(UUID(as_uuid=False), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    schema_json = Column(Text, nullable=False)
    created_by = Column(UUID(as_uuid=False), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
```

- [ ] **Step 3: Update ConversationMessage (BigInteger FK to records.id)**

```python
# backend/app/models/conversation.py
"""Conversation history — persists chat context for reopening saved records."""

from sqlalchemy import Column, BigInteger, Text, DateTime, func
from sqlalchemy.dialects.postgresql import UUID

from app.db.session import Base


class ConversationMessage(Base):
    __tablename__ = "conversation_history"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    record_id = Column(BigInteger, nullable=False, index=True)
    role = Column(Text, nullable=False)  # 'user', 'assistant', 'system'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
```

- [ ] **Step 4: Update ProjectMember (UUID user_id)**

```python
# backend/app/models/project_member.py
"""ProjectMember — links a user (subcontractor) to a project."""

import uuid
from sqlalchemy import Column, DateTime, func
from sqlalchemy.dialects.postgresql import UUID

from app.db.session import Base


class ProjectMember(Base):
    __tablename__ = "project_members"

    id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(UUID(as_uuid=False), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=False), nullable=False, index=True)
    added_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
```

- [ ] **Step 5: Update TemplateFormula (timezone-aware datetime)**

```python
# backend/app/models/template_formula.py
"""TemplateFormula — Excel-style formula attached to a template version, applied on submission."""

import uuid
from sqlalchemy import Column, String, Float, Text, DateTime, func
from sqlalchemy.dialects.postgresql import UUID

from app.db.session import Base


class TemplateFormula(Base):
    __tablename__ = "template_formulas"

    id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    template_version_id = Column(UUID(as_uuid=False), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    target_column = Column(String(10), nullable=False)
    formula_type = Column(String(20), nullable=False, default="column")
    expression = Column(String(500), nullable=False)
    weight = Column(Float, nullable=True)
    benchmark = Column(Float, nullable=True)
    scoring_rules = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=False), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
```

- [ ] **Step 6: Delete session.py**

```bash
rm backend/app/models/session.py
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/
git commit -m "feat: update all models to PostgreSQL/UUID types; drop SessionModel"
```

---

## Chunk 3: Auth Layer

### Task 7: Add Supabase config

**Files:**
- Modify: `backend/app/core/config.py`

- [ ] **Step 1: Add config fields**

In `Settings` class, add:

```python
# Supabase — current key is ECC (P-256), tokens are ES256-signed
supabase_url: str = ""          # e.g. https://xyzxyz.supabase.co
# JWKS URL is derived: {supabase_url}/auth/v1/.well-known/jwks.json
# No shared secret needed — public key fetched from JWKS
```

Keep `auth_mode`, `keycloak_*`, `session_secret`, `csrf_secret` for now (other code references them).

- [ ] **Step 2: Commit**

```bash
git add backend/app/core/config.py
git commit -m "config: add supabase_url for JWKS-based JWT validation"
```

---

### Task 8: Supabase JWT dependency (ES256 + JWKS)

Supabase's current signing key is **ECC (P-256)** = ES256 algorithm. We fetch the public key from the JWKS endpoint and cache it in memory (refreshed every hour). No shared secret is needed or used.

**Files:**
- Create: `backend/app/core/jwks.py`
- Modify: `backend/app/core/dependencies.py`

- [ ] **Step 1: Write failing test for JWKS fetcher**

```python
# backend/tests/unit/test_jwks.py
import pytest
from unittest.mock import patch, MagicMock

def test_get_jwks_returns_keys():
    mock_response = MagicMock()
    mock_response.json.return_value = {"keys": [{"kid": "abc", "kty": "EC"}]}
    mock_response.raise_for_status.return_value = None

    with patch("app.core.jwks.httpx.get", return_value=mock_response):
        from app.core.jwks import _fetch_jwks
        keys = _fetch_jwks("https://fake.supabase.co")
    assert len(keys) == 1
    assert keys[0]["kid"] == "abc"
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd backend && python -m pytest tests/unit/test_jwks.py -v
```
Expected: `ModuleNotFoundError: No module named 'app.core.jwks'`

- [ ] **Step 3: Create JWKS cache module**

```python
# backend/app/core/jwks.py
"""JWKS cache — fetches and caches Supabase public keys for ES256 validation."""

import time
import httpx
from jose import jwt, JWTError
from fastapi import HTTPException, status

_cache: dict = {"keys": [], "fetched_at": 0.0}
_TTL = 3600  # refresh keys every hour


def _fetch_jwks(supabase_url: str) -> list[dict]:
    url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
    r = httpx.get(url, timeout=10)
    r.raise_for_status()
    return r.json()["keys"]


def get_public_keys(supabase_url: str) -> list[dict]:
    """Return cached JWKS keys, refreshing if stale."""
    now = time.time()
    if now - _cache["fetched_at"] > _TTL or not _cache["keys"]:
        _cache["keys"] = _fetch_jwks(supabase_url)
        _cache["fetched_at"] = now
    return _cache["keys"]


def decode_supabase_token(token: str, supabase_url: str) -> dict:
    """Validate a Supabase-issued JWT (ES256) and return claims."""
    keys = get_public_keys(supabase_url)
    try:
        header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Malformed token: {exc}")

    kid = header.get("kid")
    matching = [k for k in keys if k.get("kid") == kid] if kid else keys

    last_exc: Exception = Exception("No matching key")
    for key in matching:
        try:
            return jwt.decode(token, key, algorithms=["ES256"], audience="authenticated")
        except JWTError as exc:
            last_exc = exc

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=f"Invalid token: {last_exc}",
    )
```

- [ ] **Step 4: Run JWKS test — expect pass**

```bash
cd backend && python -m pytest tests/unit/test_jwks.py -v
```
Expected: PASSED

- [ ] **Step 5: Write failing test for get_current_user**

```python
# backend/tests/unit/test_get_current_user.py
import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

FAKE_UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
FAKE_CLAIMS = {"sub": FAKE_UID, "role": "authenticated", "aud": "authenticated"}


@pytest.mark.asyncio
async def test_valid_token_returns_profile():
    fake_profile = MagicMock(id=FAKE_UID, role="devco_user")
    fake_db = MagicMock()
    fake_db.query.return_value.filter.return_value.first.return_value = fake_profile
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="fake.jwt.token")

    with patch("app.core.dependencies.decode_supabase_token", return_value=FAKE_CLAIMS), \
         patch("app.core.dependencies.get_settings") as ms:
        ms.return_value.supabase_url = "https://fake.supabase.co"
        from app.core.dependencies import get_current_user
        result = await get_current_user(request=MagicMock(), creds=creds, db=fake_db)
    assert result.id == FAKE_UID


@pytest.mark.asyncio
async def test_missing_creds_raises_401():
    from app.core.dependencies import get_current_user
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request=MagicMock(), creds=None, db=MagicMock())
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_profile_not_found_raises_401():
    fake_db = MagicMock()
    fake_db.query.return_value.filter.return_value.first.return_value = None
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="fake.jwt.token")

    with patch("app.core.dependencies.decode_supabase_token", return_value=FAKE_CLAIMS), \
         patch("app.core.dependencies.get_settings") as ms:
        ms.return_value.supabase_url = "https://fake.supabase.co"
        from app.core.dependencies import get_current_user
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(request=MagicMock(), creds=creds, db=fake_db)
    assert exc_info.value.status_code == 401
```

- [ ] **Step 6: Rewrite get_current_user to use ES256 + JWKS**

Replace entire contents of `backend/app/core/dependencies.py`:

```python
"""FastAPI dependencies — ES256 JWT Bearer auth via Supabase JWKS."""

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.jwks import decode_supabase_token
from app.db.session import get_db
from app.models.profile import Profile

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Profile:
    """Validate Supabase ES256 JWT and return the caller's Profile row."""
    if creds is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    settings = get_settings()
    claims = decode_supabase_token(creds.credentials, settings.supabase_url)
    user_id: str = claims.get("sub", "")

    profile = db.query(Profile).filter(Profile.id == user_id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Profile not found")

    return profile


async def verify_csrf(request: Request) -> None:
    """No-op: CSRF not needed with Bearer token auth (no cookies)."""
    pass
```

- [ ] **Step 7: Run tests**

```bash
cd backend && python -m pytest tests/unit/test_get_current_user.py tests/unit/test_jwks.py -v
```
Expected: all PASSED

- [ ] **Step 8: Commit**

```bash
git add backend/app/core/jwks.py backend/app/core/dependencies.py \
        backend/tests/unit/test_get_current_user.py backend/tests/unit/test_jwks.py
git commit -m "feat: ES256 JWT validation via Supabase JWKS; drop cookie sessions"
```

---

### Task 9: Simplify auth routes

**Files:**
- Modify: `backend/app/api/routes/auth.py`
- Modify: `backend/app/schemas/auth.py`

- [ ] **Step 1: Update UserResponse schema**

```python
# backend/app/schemas/auth.py
"""Auth response schemas."""

from pydantic import BaseModel


class UserResponse(BaseModel):
    id: str           # UUID string
    role: str | None = None
    org_id: str | None = None
    display_name: str

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Replace auth routes**

```python
# backend/app/api/routes/auth.py
"""Auth routes — /me only. Login/register handled by Supabase Auth."""

from fastapi import APIRouter, Depends, Request

from app.core.dependencies import get_current_user
from app.models.profile import Profile
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me", response_model=UserResponse)
async def me(profile: Profile = Depends(get_current_user)):
    """Return the current user's profile (from validated Supabase JWT)."""
    return profile
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/routes/auth.py backend/app/schemas/auth.py
git commit -m "feat: auth routes — /me only; login/register delegated to Supabase Auth"
```

---

## Chunk 4: Infrastructure + Route Fixes

### Task 10: Switch DB session to PostgreSQL

**Files:**
- Modify: `backend/app/db/session.py`

- [ ] **Step 1: Rewrite session.py**

```python
# backend/app/db/session.py
"""Database session — PostgreSQL via Supabase."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import get_settings

settings = get_settings()

# SQLite supported for local unit tests; production uses Supabase PostgreSQL
_sqlite = settings.database_url.startswith("sqlite")
_connect_args = {"check_same_thread": False} if _sqlite else {}

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
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/db/session.py
git commit -m "fix: session.py — remove MySQL-specific SSL/pool code; PostgreSQL only"
```

---

### Task 11: Clean up main.py

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Rewrite main.py**

```python
# backend/app/main.py
"""Whitehelmet API — FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api.routes import health, auth, ai, records, files, projects, admin, templates, assignments, subcontractor, formulas

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
```

Notes on what was removed:
- `startup` event with `Base.metadata.create_all()` — Supabase migrations own DDL
- `_migrate_columns()` — replaced by `20260505000002_schema_reconcile.sql`
- `_seed_admin()` — use Supabase Auth dashboard to create users
- `X-CSRF-Token` header — Bearer auth makes CSRF irrelevant

- [ ] **Step 2: Commit**

```bash
git add backend/app/main.py
git commit -m "fix: main.py — remove create_all, _migrate_columns, _seed_admin; clean CORS headers"
```

---

### Task 12: Fix routes that reference User/user_id

Routes import `from app.models.user import User` and filter by `Formula.user_id == user.id` (integer). These must be updated to `Profile` with UUID `id`.

**Files:**
- Modify: `backend/app/api/routes/formulas.py`
- Modify: `backend/app/api/routes/records.py`
- Modify: `backend/app/api/routes/files.py` (read first to confirm pattern)

- [ ] **Step 1: Fix formulas.py**

Replace `from app.models.user import User` → `from app.models.profile import Profile`
Replace `user: User` → `user: Profile`
Replace `Formula.user_id` → `Formula.created_by`
Replace `user_id=user.id` → `created_by=user.id`
Replace `formula_id: int` → `formula_id: str`

```python
# backend/app/api/routes/formulas.py
"""Formula library CRUD routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, verify_csrf
from app.db.session import get_db
from app.models.formula import Formula
from app.models.profile import Profile
from app.schemas.formula import FormulaCreate, FormulaResponse, FormulaListResponse

router = APIRouter(
    prefix="/api/formulas",
    tags=["formulas"],
    dependencies=[Depends(get_current_user), Depends(verify_csrf)],
)


@router.get("", response_model=FormulaListResponse)
def list_formulas(
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Formula)
        .filter(Formula.created_by == user.id)
        .order_by(Formula.created_at.desc())
        .all()
    )
    return FormulaListResponse(formulas=rows, total=len(rows))


@router.post("", response_model=FormulaResponse, status_code=status.HTTP_201_CREATED)
def create_formula(
    body: FormulaCreate,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    formula = Formula(
        created_by=user.id,
        name=body.name,
        expression=body.expression,
        description=body.description,
        nl_prompt=body.nl_prompt,
        formula_type=body.formula_type,
    )
    db.add(formula)
    db.commit()
    db.refresh(formula)
    return formula


@router.delete("/{formula_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_formula(
    formula_id: str,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    formula = (
        db.query(Formula)
        .filter(Formula.id == formula_id, Formula.created_by == user.id)
        .first()
    )
    if not formula:
        raise HTTPException(status_code=404, detail="Formula not found")
    db.delete(formula)
    db.commit()
```

- [ ] **Step 2: Fix records.py**

Change `from app.models.user import User` → `Profile`
Change `user: User` → `user: Profile`
`Record.user_id == user.id` stays the same (column renamed in model but field name stays `user_id`)

```python
# top of records.py — replace User import
from app.models.profile import Profile

# in each handler — replace User type annotation
async def list_records(user: Profile = Depends(get_current_user), ...):
async def create_record(user: Profile = Depends(get_current_user), ...):
async def get_record(user: Profile = Depends(get_current_user), ...):
async def delete_record(user: Profile = Depends(get_current_user), ...):
```

- [ ] **Step 3: Read files.py, admin.py, projects.py and fix User references**

```bash
grep -rn "from app.models.user import User" backend/app/api/routes/
```

For each match, replace with `from app.models.profile import Profile` and update type annotations.

- [ ] **Step 4: Fix formula schema — id is now str not int**

```bash
cat backend/app/schemas/formula.py
```

Look for `id: int` in `FormulaResponse` and change to `id: str`.

- [ ] **Step 5: Run the full test suite**

```bash
cd backend && python -m pytest tests/ -v --tb=short 2>&1 | tail -40
```
Expected: all passing (or only failures for missing DB connection — that's OK)

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/routes/
git commit -m "fix: routes — Profile instead of User, UUID formula_id, created_by"
```

---

### Task 13: Update .env template + README

**Files:**
- Modify: `backend/.env.example` (or create if missing)

- [ ] **Step 1: Create/update .env.example**

```bash
cat backend/.env.example 2>/dev/null || echo "not found"
```

Add or verify these vars are documented:

```
# Supabase PostgreSQL (primary DB)
DATABASE_URL=postgresql+psycopg2://postgres:[password]@db.[ref].supabase.co:5432/postgres

# Supabase project URL — JWKS is fetched from {SUPABASE_URL}/auth/v1/.well-known/jwks.json
# Current signing key is ECC (P-256) / ES256. No shared JWT secret needed.
SUPABASE_URL=https://[ref].supabase.co

# Remove these — no longer needed:
# SUPABASE_JWT_SECRET (legacy HS256 — replaced by JWKS/ES256)
# DB_SSL_CA (Supabase handles SSL natively)
# SESSION_SECRET, CSRF_SECRET (no cookie sessions)
```

- [ ] **Step 2: Commit**

```bash
git add backend/.env.example
git commit -m "docs: update env vars for Supabase — remove MySQL/session vars"
```

---

---

## Chunk 5: Frontend Auth — Supabase Client

The frontend has no supabase-js and uses cookie+CSRF auth throughout. This chunk migrates it.

**Need before starting:** `VITE_SUPABASE_ANON_KEY` from Supabase dashboard → Settings → API → Project API keys → `anon / public`.

### Task 14: Install supabase-js and create client

**Files:**
- Modify: `frontend/package.json` (via npm install)
- Create: `frontend/src/lib/supabase.ts`
- Create/update: `frontend/.env.local` (gitignored)

- [ ] **Step 1: Install supabase-js**

```bash
cd frontend && npm install @supabase/supabase-js
```

- [ ] **Step 2: Add env vars to frontend/.env.local**

```
VITE_SUPABASE_URL=https://zzxwunnnrttzuxejjwwv.supabase.co
VITE_SUPABASE_ANON_KEY=<paste anon/public key from Supabase dashboard → Settings → API>
```

- [ ] **Step 3: Create Supabase client singleton**

```typescript
// frontend/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 4: Verify build compiles**

```bash
cd frontend && npm run build 2>&1 | tail -20
```
Expected: no type errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/supabase.ts frontend/package.json frontend/package-lock.json
git commit -m "feat: install supabase-js; add client singleton"
```

---

### Task 15: Replace auth store with Supabase Auth

**Files:**
- Modify: `frontend/src/stores/auth.ts`

Current flow: POST `/api/auth/login` → cookie + CSRF token.
New flow: `supabase.auth.signInWithPassword()` → JWT session → POST `/api/auth/me` with Bearer token to load profile.

- [ ] **Step 1: Rewrite auth.ts**

```typescript
// frontend/src/stores/auth.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export interface AuthUser {
  id: string          // UUID (was number)
  display_name: string
  role?: string
  org_id?: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const checked = ref(false)

  const isAdmin = computed(() => user.value?.role === 'pif_admin')
  const orgId = computed(() => user.value?.org_id ?? null)

  async function checkSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await _loadProfile(session.access_token)
      } else {
        user.value = null
      }
    } catch {
      user.value = null
    } finally {
      checked.value = true
    }
  }

  async function login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    await _loadProfile(data.session.access_token)
    checked.value = true
  }

  async function logout() {
    await supabase.auth.signOut()
    user.value = null
  }

  async function _loadProfile(accessToken: string) {
    const resp = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!resp.ok) throw new Error('Profile not found')
    user.value = await resp.json()
  }

  return { user, checked, isAdmin, orgId, checkSession, login, logout }
})
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/stores/auth.ts
git commit -m "feat: auth store — Supabase signInWithPassword; remove cookie/CSRF"
```

---

### Task 16: Update useApi.ts — Bearer token instead of cookies/CSRF

**Files:**
- Modify: `frontend/src/composables/useApi.ts`

- [ ] **Step 1: Rewrite useApi.ts**

```typescript
// frontend/src/composables/useApi.ts
import { supabase } from '@/lib/supabase'

const BASE_URL = ''

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

async function request<T = unknown>(
  url: string,
  method: string,
  body?: unknown,
  isUpload = false,
): Promise<T> {
  const authHeaders = await getAuthHeader()
  const headers: Record<string, string> = { ...authHeaders }

  const opts: RequestInit = { method, headers }

  if (body !== undefined) {
    if (isUpload && body instanceof FormData) {
      opts.body = body
    } else {
      headers['Content-Type'] = 'application/json'
      opts.body = JSON.stringify(body)
    }
  }

  const res = await fetch(`${BASE_URL}${url}`, opts)

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new ApiError(res.status, text)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export class ApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`HTTP ${status}: ${body}`)
    this.name = 'ApiError'
  }
}

export const api = {
  get<T = unknown>(url: string): Promise<T> { return request<T>(url, 'GET') },
  post<T = unknown>(url: string, body?: unknown): Promise<T> { return request<T>(url, 'POST', body) },
  patch<T = unknown>(url: string, body?: unknown): Promise<T> { return request<T>(url, 'PATCH', body) },
  delete<T = unknown>(url: string): Promise<T> { return request<T>(url, 'DELETE') },
  upload<T = unknown>(url: string, file: File): Promise<T> {
    const form = new FormData()
    form.append('file', file)
    return request<T>(url, 'POST', form, true)
  },
  postForm<T = unknown>(url: string, formData: FormData): Promise<T> {
    return request<T>(url, 'POST', formData, true)
  },
}

// Kept as no-op for any remaining callers — CSRF is gone
export function setCsrfToken(_token: string) {}
```

- [ ] **Step 2: Fix remaining csrfToken references in components**

```bash
grep -rn "csrfToken\|X-CSRF\|setCsrfToken" frontend/src/ --include="*.ts" --include="*.vue"
```

Remove/stub any hits (TopBar, admin store, etc.).

- [ ] **Step 3: Fix AuthUser.id type — any component using id as number**

```bash
grep -rn "user\.id\b" frontend/src/ --include="*.ts" --include="*.vue"
```

Ensure no numeric comparisons remain (e.g. `user.id === 0` → `!user.id`).

- [ ] **Step 4: Build and check for type errors**

```bash
cd frontend && npm run build 2>&1 | tail -30
```
Expected: clean build

- [ ] **Step 5: Commit**

```bash
git add frontend/src/composables/useApi.ts
git commit -m "feat: useApi — Bearer token auth; remove cookies and CSRF"
```

---

### Task 17: Remove SignupView or redirect to Supabase

Registration is now handled via Supabase dashboard or a Supabase Auth UI. The `/signup` route calls `POST /api/auth/register` which is being removed.

**Files:**
- Modify: `frontend/src/views/SignupView.vue`
- Modify: `frontend/src/router/index.ts` (if signup route is removed)

- [ ] **Step 1: Check what SignupView does**

```bash
cat frontend/src/views/SignupView.vue | head -50
```

- [ ] **Step 2: Replace signup form with a message**

If self-registration is not the intended UX (PIF creates accounts for DevCos), replace `SignupView.vue` with:

```vue
<template>
  <div class="flex min-h-screen items-center justify-center bg-surface px-4">
    <div class="text-center">
      <h1 class="font-display text-2xl text-brand-400">Account access</h1>
      <p class="mt-3 text-sm text-gray-400">
        Contact your administrator to create an account.
      </p>
      <router-link :to="{ name: 'login' }" class="mt-6 inline-block text-sm text-brand-400 hover:text-brand-300">
        Back to login
      </router-link>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/views/SignupView.vue
git commit -m "feat: signup — replace form with contact-admin message"
```

---

## Open Questions

1. **`VITE_SUPABASE_ANON_KEY`** — need the `anon/public` key from Supabase → Settings → API. (The project ref is `zzxwunnnrttzuxejjwwv`.)
2. **`admin.py` routes** — do they seed/create users? Those calls will break since `User` model is gone.
3. **`files.py` route** — stores files locally; Supabase Storage migration is out of scope (local disk still works for now).
