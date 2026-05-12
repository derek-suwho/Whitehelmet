# Supabase → FastAPI Migration Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all Supabase calls in Kristen's frontend implementation with calls to our FastAPI backend, adding the required backend models, migrations, and routes.

**Architecture:** Add 6 new SQLAlchemy models (Organization, Template, TemplateVersion, TemplateAssignment, Submission, ConsolidatedSheet) with a single Alembic migration. Add 5 new route files to FastAPI. Migrate 2 Pinia stores and 4 Vue components from `supabase.`* calls to `useApi()` calls. Delete `lib/supabase.ts` and the `@supabase/supabase-js` dependency.

**Tech Stack:** FastAPI, SQLAlchemy 2, Alembic, MySQL 8 (SQLite for tests), openpyxl, Vue 3, Pinia, TypeScript, `useApi` composable

---

## Chunk 1: Backend — Models, Migration, Schemas

### Files:

- Modify: `backend/app/models/user.py` — add `role`, `org_id` columns
- Create: `backend/app/models/organization.py`
- Create: `backend/app/models/template.py`
- Create: `backend/app/models/template_version.py`
- Create: `backend/app/models/template_assignment.py`
- Create: `backend/app/models/submission.py`
- Create: `backend/app/models/consolidated_sheet.py`
- Modify: `backend/app/models/__init__.py` — export new models
- Modify: `backend/requirements.txt` — add openpyxl
- Create: `backend/migrations/versions/<hash>_add_multi_tenant_tables.py`
- Create: `backend/app/schemas/organizations.py`
- Create: `backend/app/schemas/templates.py`
- Create: `backend/app/schemas/admin.py`

---

### Task 1: Add openpyxl to requirements

- **Step 1: Add openpyxl to requirements.txt**

In `backend/requirements.txt`, add after `email-validator==2.2.0`:

```
openpyxl==3.1.5
```

- **Step 2: Install**

```bash
cd backend && pip install openpyxl==3.1.5
```

- **Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "deps: add openpyxl for xlsx parsing"
```

---

### Task 2: Extend User model

- **Step 1: Write failing test** — `backend/tests/unit/test_user_model.py`

```python
def test_user_has_role_and_org_id(db):
    from app.models.user import User
    user = User(
        external_id="ext-1",
        email="a@b.com",
        display_name="Test",
        role="pif_admin",
        org_id="org-uuid-1",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    assert user.role == "pif_admin"
    assert user.org_id == "org-uuid-1"
```

- **Step 2: Run — expect fail**

```bash
cd backend && pytest tests/unit/test_user_model.py -v
```

Expected: `AttributeError` or `OperationalError`

- **Step 3: Modify `backend/app/models/user.py`**

Add after the `password_hash` column:

```python
role = Column(String(50), nullable=True)   # pif_admin | devco_admin | devco_user
org_id = Column(String(36), nullable=True, index=True)
```

- **Step 4: Run — expect pass**

```bash
cd backend && pytest tests/unit/test_user_model.py -v
```

- **Step 5: Commit**

```bash
git add backend/app/models/user.py backend/tests/unit/test_user_model.py
git commit -m "feat: add role + org_id to User model"
```

---

### Task 3: Add Organization model

- **Step 1: Write failing test** — `backend/tests/unit/test_org_model.py`

```python
def test_create_organization(db):
    from app.models.organization import Organization
    org = Organization(id="org-1", name="PIF", type="pif")
    db.add(org)
    db.commit()
    db.refresh(org)
    assert org.id == "org-1"
    assert org.type == "pif"
    assert org.parent_org_id is None
```

- **Step 2: Run — expect fail**

```bash
cd backend && pytest tests/unit/test_org_model.py -v
```

- **Step 3: Create `backend/app/models/organization.py`**

```python
"""Organization model — PIF (root) and DevCo (member) tenants."""
import uuid
from sqlalchemy import Column, String, DateTime, func
from app.db.session import Base

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    type = Column(String(10), nullable=False)          # pif | devco
    parent_org_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
```

- **Step 4: Run — expect pass**

```bash
cd backend && pytest tests/unit/test_org_model.py -v
```

- **Step 5: Commit**

```bash
git add backend/app/models/organization.py backend/tests/unit/test_org_model.py
git commit -m "feat: add Organization model"
```

---

### Task 4: Add Template and TemplateVersion models

- **Step 1: Write failing test** — `backend/tests/unit/test_template_models.py`

```python
import json

def test_create_template(db):
    from app.models.template import Template
    t = Template(id="tmpl-1", name="QHSE Q1", status="draft")
    db.add(t)
    db.commit()
    db.refresh(t)
    assert t.status == "draft"

def test_create_template_version(db):
    from app.models.template import Template
    from app.models.template_version import TemplateVersion
    t = Template(id="tmpl-1", name="QHSE Q1", status="draft")
    db.add(t)
    db.commit()
    schema = json.dumps({"columns": []})
    v = TemplateVersion(id="ver-1", template_id="tmpl-1", version_number=1, schema_json=schema)
    db.add(v)
    db.commit()
    db.refresh(v)
    assert v.version_number == 1
```

- **Step 2: Run — expect fail**

```bash
cd backend && pytest tests/unit/test_template_models.py -v
```

- **Step 3: Create `backend/app/models/template.py`**

```python
"""Template model — versioned KPI template definitions owned by PIF."""
import uuid
from sqlalchemy import Column, String, DateTime, Text, func
from app.db.session import Base

class Template(Base):
    __tablename__ = "templates"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(String(36), nullable=True)
    status = Column(String(20), nullable=False, default="draft")  # draft | active | deprecated
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
```

- **Step 4: Create `backend/app/models/template_version.py`**

```python
"""TemplateVersion model — immutable snapshots of a template's column schema."""
import uuid
from sqlalchemy import Column, String, Integer, DateTime, Text, func
from app.db.session import Base

class TemplateVersion(Base):
    __tablename__ = "template_versions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String(36), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    schema_json = Column(Text, nullable=False)   # JSON string of SchemaJson
    created_by = Column(String(36), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
```

- **Step 5: Run — expect pass**

```bash
cd backend && pytest tests/unit/test_template_models.py -v
```

- **Step 6: Commit**

```bash
git add backend/app/models/template.py backend/app/models/template_version.py backend/tests/unit/test_template_models.py
git commit -m "feat: add Template + TemplateVersion models"
```

---

### Task 5: Add TemplateAssignment, Submission, ConsolidatedSheet models

- **Step 1: Write failing test** — `backend/tests/unit/test_submission_models.py`

```python
def test_create_assignment(db):
    from app.models.template_assignment import TemplateAssignment
    a = TemplateAssignment(id="asn-1", org_id="org-1", submission_type="template", status="pending")
    db.add(a)
    db.commit()
    db.refresh(a)
    assert a.status == "pending"

def test_create_submission(db):
    from app.models.submission import Submission
    s = Submission(
        id="sub-1", assignment_id="asn-1", org_id="org-1",
        file_path="/data/file.xlsx", file_name="report.xlsx", status="submitted"
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    assert s.status == "submitted"

def test_create_consolidated_sheet(db):
    from app.models.consolidated_sheet import ConsolidatedSheet
    cs = ConsolidatedSheet(id="cs-1", template_id="tmpl-1", file_path="/data/master.xlsx")
    db.add(cs)
    db.commit()
    db.refresh(cs)
    assert cs.template_id == "tmpl-1"
```

- **Step 2: Run — expect fail**

```bash
cd backend && pytest tests/unit/test_submission_models.py -v
```

- **Step 3: Create `backend/app/models/template_assignment.py`**

```python
"""TemplateAssignment — links a template version to a DevCo org for a submission period."""
import uuid
from sqlalchemy import Column, String, DateTime, Text, func
from app.db.session import Base

class TemplateAssignment(Base):
    __tablename__ = "template_assignments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    template_version_id = Column(String(36), nullable=True)
    org_id = Column(String(36), nullable=False, index=True)
    assigned_by = Column(String(36), nullable=True)
    deadline = Column(DateTime, nullable=True)
    submission_type = Column(String(10), nullable=False, default="template")  # template | freeform
    instructions = Column(Text, nullable=True)
    status = Column(String(10), nullable=False, default="pending")  # pending | submitted | locked
    upload_token = Column(String(255), nullable=True, unique=True)
    upload_token_expires_at = Column(DateTime, nullable=True)
    assigned_at = Column(DateTime, server_default=func.now(), nullable=False)
```

- **Step 4: Create `backend/app/models/submission.py`**

```python
"""Submission — a DevCo's xlsx file upload against an assignment."""
import uuid
from sqlalchemy import Column, String, DateTime, func
from app.db.session import Base

class Submission(Base):
    __tablename__ = "submissions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    assignment_id = Column(String(36), nullable=False, index=True)
    org_id = Column(String(36), nullable=False, index=True)
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    status = Column(String(10), nullable=False, default="submitted")  # submitted | locked
    submitted_at = Column(DateTime, server_default=func.now(), nullable=False)
    submitted_by = Column(String(36), nullable=True)
```

- **Step 5: Create `backend/app/models/consolidated_sheet.py`**

```python
"""ConsolidatedSheet — the output of a consolidation run for a template."""
import uuid
from sqlalchemy import Column, String, DateTime, func
from app.db.session import Base

class ConsolidatedSheet(Base):
    __tablename__ = "consolidated_sheets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String(36), nullable=False, index=True)
    file_path = Column(String(500), nullable=False)
    generated_by = Column(String(36), nullable=True)
    generated_at = Column(DateTime, server_default=func.now(), nullable=False)
```

- **Step 6: Run — expect pass**

```bash
cd backend && pytest tests/unit/test_submission_models.py -v
```

- **Step 7: Commit**

```bash
git add backend/app/models/template_assignment.py backend/app/models/submission.py backend/app/models/consolidated_sheet.py backend/tests/unit/test_submission_models.py
git commit -m "feat: add TemplateAssignment, Submission, ConsolidatedSheet models"
```

---

### Task 6: Update models **init** and create Alembic migration

- **Step 1: Modify `backend/app/models/__init__.py`**

```python
from app.models.user import User
from app.models.record import Record
from app.models.uploaded_file import UploadedFile
from app.models.conversation import ConversationMessage
from app.models.session import SessionModel
from app.models.organization import Organization
from app.models.template import Template
from app.models.template_version import TemplateVersion
from app.models.template_assignment import TemplateAssignment
from app.models.submission import Submission
from app.models.consolidated_sheet import ConsolidatedSheet

__all__ = [
    "User", "Record", "UploadedFile", "ConversationMessage", "SessionModel",
    "Organization", "Template", "TemplateVersion", "TemplateAssignment",
    "Submission", "ConsolidatedSheet",
]
```

- **Step 2: Also update `backend/app/main.py` startup import**

Find the line:

```python
from app.models import User, Record, UploadedFile, ConversationMessage, SessionModel  # noqa: F401
```

Replace with:

```python
from app.models import (  # noqa: F401
    User, Record, UploadedFile, ConversationMessage, SessionModel,
    Organization, Template, TemplateVersion, TemplateAssignment,
    Submission, ConsolidatedSheet,
)
```

- **Step 3: Generate Alembic migration**

```bash
cd backend && alembic revision --autogenerate -m "add multi-tenant tables"
```

Expected: new file in `migrations/versions/` with `upgrade()` and `downgrade()` functions.

- **Step 4: Inspect generated migration** — open the new file and verify it contains `create_table` calls for all 6 new tables and `add_column` for `users.role` and `users.org_id`.
- **Step 5: Commit**

```bash
git add backend/app/models/__init__.py backend/app/main.py backend/migrations/versions/
git commit -m "feat: wire all new models, generate migration"
```

---

### Task 7: Add Pydantic schemas

- **Step 1: Create `backend/app/schemas/organizations.py`**

```python
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class OrganizationCreate(BaseModel):
    name: str
    type: str           # pif | devco
    parent_org_id: Optional[str] = None

class OrganizationResponse(BaseModel):
    id: str
    name: str
    type: str
    parent_org_id: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}
```

- **Step 2: Create `backend/app/schemas/templates.py`**

```python
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Any

class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None

class TemplateResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    created_by: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}

class TemplateVersionCreate(BaseModel):
    schema_json: Any          # SchemaJson object from frontend

class TemplateVersionResponse(BaseModel):
    id: str
    template_id: str
    version_number: int
    schema_json: Any
    created_by: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}

class ConsolidatedSheetResponse(BaseModel):
    id: str
    template_id: str
    file_path: str
    generated_by: Optional[str]
    generated_at: datetime
    model_config = {"from_attributes": True}
```

- **Step 3: Create `backend/app/schemas/admin.py`**

```python
from pydantic import BaseModel
from typing import Optional

class UserWithOrgResponse(BaseModel):
    id: int
    external_id: str
    email: str
    display_name: str
    role: Optional[str]
    org_id: Optional[str]
    model_config = {"from_attributes": True}

class UpdateRoleRequest(BaseModel):
    role: str   # pif_admin | devco_admin | devco_user

class AssignmentCreate(BaseModel):
    template_version_id: Optional[str] = None
    org_ids: list[str]                 # template mode: multiple orgs
    org_id: Optional[str] = None       # freeform mode: single org
    deadline: Optional[str] = None
    instructions: Optional[str] = None
    submission_type: str = "template"  # template | freeform

class AssignmentResponse(BaseModel):
    id: str
    org_id: str
    submission_type: str
    status: str
    upload_token: Optional[str]
    model_config = {"from_attributes": True}
```

- **Step 4: Commit**

```bash
git add backend/app/schemas/organizations.py backend/app/schemas/templates.py backend/app/schemas/admin.py
git commit -m "feat: add org/template/admin Pydantic schemas"
```

---

## Chunk 2: Backend — Routes

### Files:

- Create: `backend/app/api/routes/organizations.py`
- Create: `backend/app/api/routes/admin.py`
- Create: `backend/app/api/routes/templates.py`
- Create: `backend/app/api/routes/assignments.py`
- Modify: `backend/app/api/routes/ai.py` — add parse-template, template-generate, finetune endpoints
- Modify: `backend/app/main.py` — register new routers
- Create: `backend/tests/integration/test_organizations.py`
- Create: `backend/tests/integration/test_templates.py`
- Create: `backend/tests/integration/test_admin.py`
- Create: `backend/tests/integration/test_ai_new.py`

---

### Task 8: Organization routes

- **Step 1: Write failing test** — `backend/tests/integration/test_organizations.py`

```python
def test_list_organizations_empty(auth_client):
    resp = auth_client.get("/api/organizations")
    assert resp.status_code == 200
    assert resp.json() == []

def test_create_and_list_organization(auth_client):
    resp = auth_client.post("/api/organizations", json={"name": "PIF", "type": "pif"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "PIF"
    assert data["type"] == "pif"

    resp2 = auth_client.get("/api/organizations")
    assert len(resp2.json()) == 1
```

- **Step 2: Run — expect 404 (route not found)**

```bash
cd backend && pytest tests/integration/test_organizations.py -v
```

- **Step 3: Create `backend/app/api/routes/organizations.py`**

```python
"""Organization routes — list and create orgs."""
import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, verify_csrf
from app.db.session import get_db
from app.models.organization import Organization
from app.models.user import User
from app.schemas.organizations import OrganizationCreate, OrganizationResponse

router = APIRouter(
    prefix="/api/organizations",
    tags=["organizations"],
    dependencies=[Depends(get_current_user)],
)

@router.get("", response_model=list[OrganizationResponse])
def list_organizations(db: Session = Depends(get_db)):
    return db.query(Organization).order_by(Organization.name).all()

@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(verify_csrf)])
def create_organization(body: OrganizationCreate, db: Session = Depends(get_db)):
    org = Organization(
        id=str(uuid.uuid4()),
        name=body.name,
        type=body.type,
        parent_org_id=body.parent_org_id,
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    return org
```

- **Step 4: Register in `backend/app/main.py`** — add after existing imports:

```python
from app.api.routes import health, auth, ai, records, files, organizations
```

And add:

```python
app.include_router(organizations.router)
```

- **Step 5: Run — expect pass**

```bash
cd backend && pytest tests/integration/test_organizations.py -v
```

- **Step 6: Commit**

```bash
git add backend/app/api/routes/organizations.py backend/app/main.py backend/tests/integration/test_organizations.py
git commit -m "feat: organization routes GET + POST"
```

---

### Task 9: Admin user routes

- **Step 1: Write failing test** — `backend/tests/integration/test_admin.py`

```python
def test_list_users(auth_client, test_user):
    resp = auth_client.get("/api/admin/users")
    assert resp.status_code == 200
    users = resp.json()
    assert any(u["email"] == "test@whitehelmet.com" for u in users)

def test_update_user_role(auth_client, test_user):
    resp = auth_client.patch(
        f"/api/admin/users/{test_user.id}/role",
        json={"role": "devco_admin"},
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "devco_admin"
```

- **Step 2: Run — expect 404**

```bash
cd backend && pytest tests/integration/test_admin.py -v
```

- **Step 3: Create `backend/app/api/routes/admin.py`**

```python
"""Admin routes — user management."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, verify_csrf
from app.db.session import get_db
from app.models.user import User
from app.schemas.admin import UserWithOrgResponse, UpdateRoleRequest

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(get_current_user)],
)

@router.get("/users", response_model=list[UserWithOrgResponse])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.display_name).all()

@router.patch("/users/{user_id}/role", response_model=UserWithOrgResponse,
              dependencies=[Depends(verify_csrf)])
def update_user_role(user_id: int, body: UpdateRoleRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = body.role
    db.commit()
    db.refresh(user)
    return user
```

- **Step 4: Register in `backend/app/main.py`**

Add `admin` to the import line and add:

```python
app.include_router(admin.router)
```

- **Step 5: Run — expect pass**

```bash
cd backend && pytest tests/integration/test_admin.py -v
```

- **Step 6: Commit**

```bash
git add backend/app/api/routes/admin.py backend/app/main.py backend/tests/integration/test_admin.py
git commit -m "feat: admin user routes"
```

---

### Task 10: Template routes

- **Step 1: Write failing test** — `backend/tests/integration/test_templates.py`

```python
import json

def test_create_template(auth_client):
    resp = auth_client.post("/api/templates", json={"name": "QHSE Q1"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "QHSE Q1"
    assert data["status"] == "draft"
    return data["id"]

def test_list_templates(auth_client):
    auth_client.post("/api/templates", json={"name": "T1"})
    auth_client.post("/api/templates", json={"name": "T2"})
    resp = auth_client.get("/api/templates")
    assert resp.status_code == 200
    assert len(resp.json()) == 2

def test_get_template(auth_client):
    created = auth_client.post("/api/templates", json={"name": "T1"}).json()
    resp = auth_client.get(f"/api/templates/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]

def test_save_and_list_versions(auth_client):
    tmpl = auth_client.post("/api/templates", json={"name": "T1"}).json()
    schema = {"columns": [{"id": "c1", "name": "Incidents", "type": "number"}]}
    resp = auth_client.post(
        f"/api/templates/{tmpl['id']}/versions",
        json={"schema_json": schema},
    )
    assert resp.status_code == 201
    assert resp.json()["version_number"] == 1

def test_publish_template(auth_client):
    tmpl = auth_client.post("/api/templates", json={"name": "T1"}).json()
    resp = auth_client.patch(f"/api/templates/{tmpl['id']}/status", json={"status": "active"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"
```

- **Step 2: Run — expect 404**

```bash
cd backend && pytest tests/integration/test_templates.py -v
```

- **Step 3: Create `backend/app/api/routes/templates.py`**

```python
"""Template routes — CRUD, versioning, status management."""
import uuid, json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, verify_csrf
from app.db.session import get_db
from app.models.template import Template
from app.models.template_version import TemplateVersion
from app.models.consolidated_sheet import ConsolidatedSheet
from app.models.user import User
from app.schemas.templates import (
    TemplateCreate, TemplateResponse,
    TemplateVersionCreate, TemplateVersionResponse,
    ConsolidatedSheetResponse,
)

router = APIRouter(
    prefix="/api/templates",
    tags=["templates"],
    dependencies=[Depends(get_current_user)],
)

@router.get("", response_model=list[TemplateResponse])
def list_templates(db: Session = Depends(get_db)):
    return db.query(Template).order_by(Template.updated_at.desc()).all()

@router.post("", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(verify_csrf)])
def create_template(body: TemplateCreate, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    tmpl = Template(
        id=str(uuid.uuid4()),
        name=body.name,
        description=body.description,
        created_by=str(user.id),
        status="draft",
    )
    db.add(tmpl)
    db.commit()
    db.refresh(tmpl)
    return tmpl

@router.get("/{template_id}", response_model=TemplateResponse)
def get_template(template_id: str, db: Session = Depends(get_db)):
    tmpl = db.query(Template).filter(Template.id == template_id).first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return tmpl

@router.patch("/{template_id}/status", response_model=TemplateResponse,
              dependencies=[Depends(verify_csrf)])
def update_status(template_id: str, body: dict, db: Session = Depends(get_db)):
    tmpl = db.query(Template).filter(Template.id == template_id).first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    new_status = body.get("status")
    if new_status not in ("draft", "active", "deprecated"):
        raise HTTPException(status_code=422, detail="Invalid status")
    tmpl.status = new_status
    db.commit()
    db.refresh(tmpl)
    return tmpl

@router.get("/{template_id}/versions", response_model=list[TemplateVersionResponse])
def list_versions(template_id: str, db: Session = Depends(get_db)):
    return (
        db.query(TemplateVersion)
        .filter(TemplateVersion.template_id == template_id)
        .order_by(TemplateVersion.version_number.desc())
        .all()
    )

@router.post("/{template_id}/versions", response_model=TemplateVersionResponse,
             status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_csrf)])
def save_version(template_id: str, body: TemplateVersionCreate,
                 user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tmpl = db.query(Template).filter(Template.id == template_id).first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")

    last = (
        db.query(TemplateVersion)
        .filter(TemplateVersion.template_id == template_id)
        .order_by(TemplateVersion.version_number.desc())
        .first()
    )
    next_version = (last.version_number if last else 0) + 1

    ver = TemplateVersion(
        id=str(uuid.uuid4()),
        template_id=template_id,
        version_number=next_version,
        schema_json=json.dumps(body.schema_json),
        created_by=str(user.id),
    )
    db.add(ver)
    db.commit()
    db.refresh(ver)

    # Return schema_json as parsed object
    ver.schema_json = body.schema_json
    return ver

@router.get("/{template_id}/consolidations", response_model=list[ConsolidatedSheetResponse])
def list_consolidations(template_id: str, db: Session = Depends(get_db)):
    return (
        db.query(ConsolidatedSheet)
        .filter(ConsolidatedSheet.template_id == template_id)
        .order_by(ConsolidatedSheet.generated_at.desc())
        .all()
    )
```

- **Step 4: Register in `backend/app/main.py`** — add `templates` to imports and `app.include_router(templates.router)`
- **Step 5: Run — expect pass**

```bash
cd backend && pytest tests/integration/test_templates.py -v
```

- **Step 6: Commit**

```bash
git add backend/app/api/routes/templates.py backend/app/main.py backend/tests/integration/test_templates.py
git commit -m "feat: template CRUD + versioning routes"
```

---

### Task 11: Assignment routes and consolidation endpoint

- **Step 1: Write failing test** — `backend/tests/integration/test_assignments.py`

```python
def test_create_template_assignment(auth_client):
    resp = auth_client.post("/api/assignments", json={
        "template_version_id": "ver-1",
        "org_ids": ["org-1", "org-2"],
        "deadline": "2026-06-01",
        "submission_type": "template",
    })
    assert resp.status_code == 201
    assignments = resp.json()
    assert len(assignments) == 2
    assert all(a["status"] == "pending" for a in assignments)

def test_create_freeform_assignment(auth_client):
    resp = auth_client.post("/api/assignments", json={
        "org_id": "org-1",
        "submission_type": "freeform",
    })
    assert resp.status_code == 201
    assignments = resp.json()
    assert len(assignments) == 1
    assert assignments[0]["upload_token"] is not None
```

- **Step 2: Run — expect 404**

```bash
cd backend && pytest tests/integration/test_assignments.py -v
```

- **Step 3: Create `backend/app/api/routes/assignments.py`**

```python
"""Assignment routes — distribute templates or freeform links to DevCos."""
import uuid, secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, verify_csrf
from app.db.session import get_db
from app.models.template_assignment import TemplateAssignment
from app.models.user import User
from app.schemas.admin import AssignmentCreate, AssignmentResponse

router = APIRouter(
    prefix="/api/assignments",
    tags=["assignments"],
    dependencies=[Depends(get_current_user), Depends(verify_csrf)],
)

@router.post("", response_model=list[AssignmentResponse], status_code=status.HTTP_201_CREATED)
def create_assignments(body: AssignmentCreate, user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    results = []

    if body.submission_type == "template":
        deadline_dt = datetime.fromisoformat(body.deadline) if body.deadline else None
        for org_id in body.org_ids:
            a = TemplateAssignment(
                id=str(uuid.uuid4()),
                template_version_id=body.template_version_id,
                org_id=org_id,
                assigned_by=str(user.id),
                deadline=deadline_dt,
                submission_type="template",
                status="pending",
            )
            db.add(a)
            results.append(a)
    else:
        # Freeform: generate upload token (valid 7 days)
        token = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + timedelta(days=7)
        a = TemplateAssignment(
            id=str(uuid.uuid4()),
            org_id=body.org_id or "",
            assigned_by=str(user.id),
            submission_type="freeform",
            instructions=body.instructions,
            deadline=datetime.fromisoformat(body.deadline) if body.deadline else None,
            status="pending",
            upload_token=token,
            upload_token_expires_at=expires,
        )
        db.add(a)
        results.append(a)

    db.commit()
    for a in results:
        db.refresh(a)
    return results
```

- **Step 4: Register in `backend/app/main.py`** — add `assignments` to imports and `app.include_router(assignments.router)`
- **Step 5: Run — expect pass**

```bash
cd backend && pytest tests/integration/test_assignments.py -v
```

- **Step 6: Commit**

```bash
git add backend/app/api/routes/assignments.py backend/app/main.py backend/tests/integration/test_assignments.py
git commit -m "feat: assignment routes (template + freeform)"
```

---

### Task 12: AI routes — parse-template, template-generate, finetune, consolidate

- **Step 1: Add parse-template endpoint to `backend/app/api/routes/ai.py`**

Add these imports at the top:

```python
import io
import openpyxl
from fastapi import UploadFile, File
```

Add this endpoint (after `/command`):

```python
@router.post("/parse-template")
async def parse_template(file: UploadFile = File(...)):
    """Parse an xlsx file and return inferred column definitions."""
    content = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return {"columns": []}

    headers = [str(h) if h is not None else f"Column{i}" for i, h in enumerate(rows[0])]
    # Sample up to 5 data rows for type inference
    data_rows = rows[1:6]

    def infer_type(col_idx):
        samples = [r[col_idx] for r in data_rows if col_idx < len(r) and r[col_idx] is not None]
        if not samples:
            return "text", []
        if all(isinstance(v, (int, float)) for v in samples):
            return "number", [str(v) for v in samples]
        return "text", [str(v) for v in samples]

    columns = []
    for i, name in enumerate(headers):
        t, samples = infer_type(i)
        columns.append({"name": name, "inferred_type": t, "sample_values": samples})

    return {"columns": columns}
```

- **Step 2: Add template-generate endpoint to `backend/app/api/routes/ai.py`**

```python
@router.post("/template-generate")
async def template_generate(body: dict):
    """Generate a template schema from a natural-language prompt."""
    prompt = body.get("prompt", "")
    system = (
        "You are a KPI template designer. Given a description, return ONLY a JSON object: "
        '{"schema_json": {"columns": [{"id": "<uuid>", "name": "<col name>", "type": "text|number|date|percentage"}]}} '
        "No markdown. No extra text."
    )
    data = await _openrouter_post({
        "model": "anthropic/claude-sonnet-4-5",
        "max_tokens": 1024,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
    })
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
    try:
        return json.loads(content.strip())
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI returned invalid JSON")
```

- **Step 3: Add finetune endpoint to `backend/app/api/routes/ai.py`**

```python
@router.post("/finetune")
async def finetune_consolidated(body: dict):
    """Apply a natural-language change to a consolidated sheet (by ID)."""
    consolidated_sheet_id = body.get("consolidated_sheet_id")
    prompt = body.get("prompt", "")
    if not consolidated_sheet_id:
        raise HTTPException(status_code=422, detail="consolidated_sheet_id required")

    system = (
        "You are a spreadsheet assistant. The user wants to modify a consolidated master sheet. "
        "Acknowledge the change and describe what you would do. "
        "Return JSON: {\"message\": \"<description of change applied>\"}"
    )
    data = await _openrouter_post({
        "model": "anthropic/claude-sonnet-4-5",
        "max_tokens": 256,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
    })
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
    try:
        return json.loads(content.strip())
    except json.JSONDecodeError:
        return {"message": content}
```

- **Step 4: Write a basic test for parse-template** — `backend/tests/integration/test_ai_new.py`

```python
import io
import openpyxl

def make_xlsx(headers, rows):
    """Helper: create in-memory xlsx bytes."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(headers)
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()

def test_parse_template_returns_columns(client):
    xlsx_bytes = make_xlsx(
        ["Incident Count", "Date", "Notes"],
        [[5, "2026-01-01", "ok"], [3, "2026-01-02", "fine"]],
    )
    resp = client.post(
        "/api/ai/parse-template",
        files={"file": ("test.xlsx", xlsx_bytes, "application/octet-stream")},
    )
    assert resp.status_code == 200
    cols = resp.json()["columns"]
    assert len(cols) == 3
    assert cols[0]["name"] == "Incident Count"
    assert cols[0]["inferred_type"] == "number"
```

- **Step 5: Run — expect pass**

```bash
cd backend && pytest tests/integration/test_ai_new.py::test_parse_template_returns_columns -v
```

- **Step 6: Add consolidation download route to `backend/app/api/routes/templates.py`**

Add this import:

```python
from pathlib import Path
from fastapi.responses import FileResponse as FastAPIFileResponse
```

Add this route at the end of `templates.py`:

```python
@router.get("/consolidations/{sheet_id}/download")
def download_consolidated(sheet_id: str, db: Session = Depends(get_db)):
    sheet = db.query(ConsolidatedSheet).filter(ConsolidatedSheet.id == sheet_id).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Consolidated sheet not found")
    path = Path(sheet.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FastAPIFileResponse(
        path=str(path),
        filename=f"consolidated_{sheet_id}.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
```

- **Step 7: Commit all AI + download changes**

```bash
git add backend/app/api/routes/ai.py backend/app/api/routes/templates.py backend/tests/integration/test_ai_new.py
git commit -m "feat: parse-template, template-generate, finetune AI routes + consolidation download"
```

---

### Task 13: Run full backend test suite

- **Step 1: Run all tests**

```bash
cd backend && pytest --cov=app --cov-report=term-missing -v
```

Expected: all existing tests still pass, new tests pass, coverage ≥ 80%.

- **Step 2: Fix any regressions before continuing**

---

## Chunk 3: Frontend — Store and View Migration

### Files:

- Modify: `frontend/src/types/database.ts` — remove Supabase Database wrapper, keep row types as plain interfaces
- Modify: `frontend/src/stores/templates.ts` — replace supabase with useApi
- Modify: `frontend/src/stores/admin.ts` — replace supabase with useApi
- Modify: `frontend/src/components/template/AIChatPanel.vue` — replace supabase.functions.invoke
- Modify: `frontend/src/views/admin/modals/ImportTemplateModal.vue` — replace supabase storage + function
- Modify: `frontend/src/views/admin/modals/AssignmentModal.vue` — replace supabase calls
- Modify: `frontend/src/views/admin/ConsolidationDashboardView.vue` — replace supabase calls
- Delete: `frontend/src/lib/supabase.ts`
- Modify: `frontend/package.json` — remove @supabase/supabase-js

---

### Task 14: Simplify types/database.ts

- **Step 1: Replace `frontend/src/types/database.ts` entirely**

```typescript
// Plain TypeScript types — no Supabase dependency

export interface Organization {
  id: string
  name: string
  type: 'pif' | 'devco'
  parent_org_id: string | null
  created_at: string
}

export interface Profile {
  id: string
  org_id: string | null
  role: 'pif_admin' | 'devco_admin' | 'devco_user'
  display_name: string
  created_at: string
}

export interface Template {
  id: string
  name: string
  description: string | null
  created_by: string | null
  status: 'draft' | 'active' | 'deprecated'
  created_at: string
  updated_at: string
}

export interface TemplateVersion {
  id: string
  template_id: string
  version_number: number
  schema_json: SchemaJson
  created_by: string | null
  created_at: string
}

export interface TemplateAssignment {
  id: string
  template_version_id: string | null
  org_id: string
  assigned_by: string | null
  deadline: string | null
  submission_type: 'template' | 'freeform'
  instructions: string | null
  status: 'pending' | 'submitted' | 'locked'
  upload_token: string | null
  upload_token_expires_at: string | null
  assigned_at: string
}

export interface Submission {
  id: string
  assignment_id: string
  org_id: string
  file_path: string
  file_name: string
  status: 'submitted' | 'locked'
  submitted_at: string
  submitted_by: string | null
}

export interface ConsolidatedSheet {
  id: string
  template_id: string
  file_path: string
  generated_by: string | null
  generated_at: string
}

export interface SchemaColumn {
  id: string
  name: string
  type: 'text' | 'number' | 'date' | 'percentage'
  description?: string
  formula_id?: string
  validation?: {
    required?: boolean
    min?: number
    max?: number
    options?: string[]
  }
}

export interface SchemaJson {
  columns: SchemaColumn[]
}
```

- **Step 2: Type-check**

```bash
cd frontend && npm run type-check 2>&1 | head -40
```

Note any errors — they'll be resolved in subsequent tasks.

- **Step 3: Commit**

```bash
git add frontend/src/types/database.ts
git commit -m "refactor: simplify database types, remove Supabase wrapper"
```

---

### Task 15: Migrate stores/templates.ts

- **Step 1: Replace `frontend/src/stores/templates.ts` entirely**

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/composables/useApi'
import type { Template, TemplateVersion, ConsolidatedSheet, SchemaJson } from '@/types/database'

export const useTemplatesStore = defineStore('templates', () => {
  const templates = ref<Template[]>([])
  const currentTemplate = ref<Template | null>(null)
  const currentVersion = ref<TemplateVersion | null>(null)
  const versions = ref<TemplateVersion[]>([])
  const consolidatedSheets = ref<ConsolidatedSheet[]>([])

  async function fetchTemplates() {
    templates.value = await api.get<Template[]>('/api/templates')
  }

  async function fetchTemplate(id: string) {
    currentTemplate.value = await api.get<Template>(`/api/templates/${id}`)
    versions.value = await api.get<TemplateVersion[]>(`/api/templates/${id}/versions`)
    currentVersion.value = versions.value[0] ?? null
  }

  async function createTemplate(name: string, description: string): Promise<Template> {
    const tmpl = await api.post<Template>('/api/templates', { name, description })
    templates.value.unshift(tmpl)
    currentTemplate.value = tmpl
    return tmpl
  }

  async function saveVersion(templateId: string, schemaJson: SchemaJson): Promise<TemplateVersion> {
    const ver = await api.post<TemplateVersion>(
      `/api/templates/${templateId}/versions`,
      { schema_json: schemaJson },
    )
    versions.value.unshift(ver)
    currentVersion.value = ver
    return ver
  }

  async function publishTemplate(templateId: string) {
    const updated = await api.patch<Template>(`/api/templates/${templateId}/status`, { status: 'active' })
    _syncTemplate(updated)
  }

  async function deprecateTemplate(templateId: string) {
    const updated = await api.patch<Template>(`/api/templates/${templateId}/status`, { status: 'deprecated' })
    _syncTemplate(updated)
  }

  function _syncTemplate(updated: Template) {
    const idx = templates.value.findIndex(t => t.id === updated.id)
    if (idx !== -1) templates.value[idx] = updated
    if (currentTemplate.value?.id === updated.id) currentTemplate.value = updated
  }

  async function fetchConsolidatedSheets(templateId: string) {
    consolidatedSheets.value = await api.get<ConsolidatedSheet[]>(`/api/templates/${templateId}/consolidations`)
  }

  async function getDownloadUrl(sheetId: string): Promise<string> {
    return `/api/templates/consolidations/${sheetId}/download`
  }

  return {
    templates, currentTemplate, currentVersion, versions, consolidatedSheets,
    fetchTemplates, fetchTemplate, createTemplate, saveVersion,
    publishTemplate, deprecateTemplate, fetchConsolidatedSheets, getDownloadUrl,
  }
})
```

- **Step 2: Type-check**

```bash
cd frontend && npm run type-check 2>&1 | grep templates
```

- **Step 3: Commit**

```bash
git add frontend/src/stores/templates.ts
git commit -m "feat: migrate templates store from Supabase to FastAPI"
```

---

### Task 16: Migrate stores/admin.ts

- **Step 1: Check what `useApi` supports** — open `frontend/src/composables/useApi.ts` and verify it exports `api.get`, `api.post`, `api.patch`. If `patch` is missing, add it.

Expected content of `useApi.ts` patch method (add if missing):

```typescript
async patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body })
}
```

- **Step 2: Replace `frontend/src/stores/admin.ts` entirely**

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/composables/useApi'
import type { Organization } from '@/types/database'

export interface UserWithOrg {
  id: number
  external_id: string
  email: string
  display_name: string
  role?: string
  org_id?: string
}

export const useAdminStore = defineStore('admin', () => {
  const organizations = ref<Organization[]>([])
  const users = ref<UserWithOrg[]>([])

  async function fetchOrganizations() {
    organizations.value = await api.get<Organization[]>('/api/organizations')
  }

  async function createOrganization(
    name: string,
    type: 'pif' | 'devco',
    parentOrgId?: string,
  ): Promise<Organization> {
    const org = await api.post<Organization>('/api/organizations', {
      name, type, parent_org_id: parentOrgId ?? null,
    })
    organizations.value.push(org)
    return org
  }

  async function fetchUsers() {
    users.value = await api.get<UserWithOrg[]>('/api/admin/users')
  }

  async function createUser(
    email: string,
    displayName: string,
    orgId: string,
    role: 'pif_admin' | 'devco_admin' | 'devco_user',
  ): Promise<void> {
    // User creation handled via register endpoint; role/org assigned separately
    await api.post('/api/auth/register', { email, password: 'ChangeMe123!', display_name: displayName })
    const created = users.value.find(u => u.email === email)
    if (created) await updateUserRole(created.id, role)
    await fetchUsers()
  }

  async function updateUserRole(
    userId: number,
    role: 'pif_admin' | 'devco_admin' | 'devco_user',
  ): Promise<void> {
    const updated = await api.patch<UserWithOrg>(`/api/admin/users/${userId}/role`, { role })
    const u = users.value.find(u => u.id === userId)
    if (u) u.role = updated.role
  }

  return { organizations, users, fetchOrganizations, createOrganization, fetchUsers, createUser, updateUserRole }
})
```

- **Step 3: Type-check**

```bash
cd frontend && npm run type-check 2>&1 | grep admin
```

- **Step 4: Commit**

```bash
git add frontend/src/stores/admin.ts
git commit -m "feat: migrate admin store from Supabase to FastAPI"
```

---

### Task 17: Migrate AIChatPanel.vue

- **Step 1: Replace the `<script setup>` block in `frontend/src/components/template/AIChatPanel.vue`**

Replace the entire `<script setup>` with:

```typescript
<script setup lang="ts">
import { ref } from 'vue'
import { api } from '@/composables/useApi'

const props = defineProps<{
  mode: 'template-builder' | 'consolidation-finetune'
  templateId?: string
  consolidatedSheetId?: string
}>()

const emit = defineEmits<{
  'schema-generated': [schemaJson: object]
  'finetune-applied': []
}>()

interface Message { role: 'user' | 'assistant'; content: string }

const messages = ref<Message[]>([])
const input = ref('')
const loading = ref(false)
const error = ref('')

async function send() {
  const text = input.value.trim()
  if (!text || loading.value) return
  messages.value.push({ role: 'user', content: text })
  input.value = ''
  loading.value = true
  error.value = ''
  try {
    if (props.mode === 'template-builder') await sendTemplateBuilder(text)
    else await sendFinetune(text)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Something went wrong'
  } finally {
    loading.value = false
  }
}

async function sendTemplateBuilder(prompt: string) {
  const data = await api.post<{ schema_json: object }>('/api/ai/template-generate', { prompt })
  if (data?.schema_json) {
    emit('schema-generated', data.schema_json)
    const colCount = (data.schema_json as { columns: unknown[] }).columns?.length ?? 0
    messages.value.push({
      role: 'assistant',
      content: `Generated a template with ${colCount} column${colCount !== 1 ? 's' : ''}. Review and adjust in the editor.`,
    })
  }
}

async function sendFinetune(prompt: string) {
  if (!props.consolidatedSheetId) throw new Error('No consolidated sheet selected')
  const data = await api.post<{ message: string }>('/api/ai/finetune', {
    consolidated_sheet_id: props.consolidatedSheetId,
    prompt,
  })
  emit('finetune-applied')
  messages.value.push({ role: 'assistant', content: data?.message ?? 'Changes applied.' })
}
</script>
```

Keep the `<template>` block unchanged.

- **Step 2: Type-check**

```bash
cd frontend && npm run type-check 2>&1 | grep AIChatPanel
```

- **Step 3: Commit**

```bash
git add frontend/src/components/template/AIChatPanel.vue
git commit -m "feat: migrate AIChatPanel to FastAPI"
```

---

### Task 18: Migrate ImportTemplateModal.vue

- **Step 1: Replace the `<script setup>` block in `frontend/src/views/admin/modals/ImportTemplateModal.vue`**

Replace entirely with:

```typescript
<script setup lang="ts">
import { ref } from 'vue'
import { api } from '@/composables/useApi'
import { useTemplatesStore } from '@/stores/templates'
import type { SchemaColumn } from '@/types/database'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; created: [templateId: string] }>()

const templatesStore = useTemplatesStore()

const step = ref<1 | 2>(1)
const uploading = ref(false)
const error = ref('')
const templateName = ref('')
const parsedColumns = ref<Array<{
  name: string
  inferred_type: 'text' | 'number' | 'date' | 'percentage'
  sample_values: string[]
}>>([])

async function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.name.endsWith('.xlsx')) { error.value = 'Only .xlsx files are supported.'; return }
  error.value = ''
  uploading.value = true
  templateName.value = file.name.replace('.xlsx', '')
  try {
    const formData = new FormData()
    formData.append('file', file)
    const data = await api.postForm<{ columns: typeof parsedColumns.value }>('/api/ai/parse-template', formData)
    parsedColumns.value = data.columns ?? []
    step.value = 2
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Upload failed'
  } finally {
    uploading.value = false
  }
}

async function confirm() {
  if (!templateName.value.trim()) { error.value = 'Template name is required.'; return }
  uploading.value = true
  error.value = ''
  try {
    const template = await templatesStore.createTemplate(templateName.value, '')
    const schemaJson = {
      columns: parsedColumns.value.map((c) => ({
        id: crypto.randomUUID(),
        name: c.name,
        type: c.inferred_type,
      } satisfies SchemaColumn)),
    }
    await templatesStore.saveVersion(template.id, schemaJson)
    emit('created', template.id)
    emit('close')
    reset()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to create template'
  } finally {
    uploading.value = false
  }
}

function reset() {
  step.value = 1; parsedColumns.value = []; templateName.value = ''; error.value = ''
}
</script>
```

Keep the `<template>` block unchanged.

- **Step 2: Add `postForm` to `useApi.ts`** — open `frontend/src/composables/useApi.ts` and add:

```typescript
async postForm<T>(path: string, formData: FormData): Promise<T> {
  const resp = await fetch(path, { method: 'POST', body: formData, credentials: 'include' })
  if (!resp.ok) throw new Error(await resp.text())
  return resp.json()
}
```

- **Step 3: Type-check**

```bash
cd frontend && npm run type-check 2>&1 | grep ImportTemplate
```

- **Step 4: Commit**

```bash
git add frontend/src/views/admin/modals/ImportTemplateModal.vue frontend/src/composables/useApi.ts
git commit -m "feat: migrate ImportTemplateModal to FastAPI"
```

---

### Task 19: Migrate AssignmentModal.vue

- **Step 1: Replace the `<script setup>` block in `frontend/src/views/admin/modals/AssignmentModal.vue`**

```typescript
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/composables/useApi'
import { useAdminStore } from '@/stores/admin'
import type { TemplateAssignment } from '@/types/database'

const props = defineProps<{ open: boolean; templateVersionId: string }>()
const emit = defineEmits<{ close: []; assigned: [] }>()

const adminStore = useAdminStore()
const mode = ref<'template' | 'freeform'>('template')
const selectedOrgIds = ref<string[]>([])
const selectedOrgId = ref('')
const deadline = ref('')
const instructions = ref('')
const loading = ref(false)
const error = ref('')
const successUrl = ref('')

onMounted(() => adminStore.fetchOrganizations())
const devcoOrgs = () => adminStore.organizations.filter((o) => o.type === 'devco')

async function assign() {
  error.value = ''
  loading.value = true
  try {
    if (mode.value === 'template') {
      if (!selectedOrgIds.value.length) throw new Error('Select at least one DevCo.')
      if (!deadline.value) throw new Error('Deadline is required.')
      await api.post<TemplateAssignment[]>('/api/assignments', {
        template_version_id: props.templateVersionId,
        org_ids: selectedOrgIds.value,
        deadline: deadline.value,
        submission_type: 'template',
      })
      emit('assigned')
      emit('close')
    } else {
      if (!selectedOrgId.value) throw new Error('Select a DevCo.')
      const assignments = await api.post<TemplateAssignment[]>('/api/assignments', {
        org_id: selectedOrgId.value,
        org_ids: [],
        submission_type: 'freeform',
        instructions: instructions.value || undefined,
        deadline: deadline.value || undefined,
      })
      const token = assignments[0]?.upload_token
      successUrl.value = token ? `${window.location.origin}/upload/${token}` : ''
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed'
  } finally {
    loading.value = false
  }
}

function copyUrl() { navigator.clipboard.writeText(successUrl.value) }
</script>
```

Keep the `<template>` block unchanged.

- **Step 2: Type-check**

```bash
cd frontend && npm run type-check 2>&1 | grep AssignmentModal
```

- **Step 3: Commit**

```bash
git add frontend/src/views/admin/modals/AssignmentModal.vue
git commit -m "feat: migrate AssignmentModal to FastAPI"
```

---

### Task 20: Migrate ConsolidationDashboardView.vue

- **Step 1: Replace the `<script setup>` block in `frontend/src/views/admin/ConsolidationDashboardView.vue`**

```typescript
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '@/composables/useApi'
import { useTemplatesStore } from '@/stores/templates'
import AIChatPanel from '@/components/template/AIChatPanel.vue'
import ConsolidationStatusModal from './modals/ConsolidationStatusModal.vue'
import SpreadsheetEditor from '@/components/editor/SpreadsheetEditor.vue'

const route = useRoute()
const templatesStore = useTemplatesStore()

const templateId = route.params.templateId as string
const allSubmitted = ref(false)
const consolidating = ref(false)
const consolidationResult = ref<{
  consolidated_sheet_id: string
  file_path: string
  freeform_count: number
  template_count: number
} | null>(null)
const consolidationError = ref('')
const showStatusModal = ref(false)
const masterSheetData = ref(null)
const consolidatedSheetId = ref('')

onMounted(() => templatesStore.fetchTemplate(templateId))

function onAllSubmitted() { allSubmitted.value = true }

async function consolidate() {
  if (!templatesStore.currentVersion) return
  consolidating.value = true
  consolidationError.value = ''
  consolidationResult.value = null
  showStatusModal.value = true
  try {
    const data = await api.post<typeof consolidationResult.value>('/api/ai/consolidate', {
      template_id: templateId,
      template_version_id: templatesStore.currentVersion.id,
    })
    consolidationResult.value = data
    consolidatedSheetId.value = data?.consolidated_sheet_id ?? ''
  } catch (e) {
    consolidationError.value = e instanceof Error ? e.message : 'Consolidation failed'
  } finally {
    consolidating.value = false
  }
}

async function download() {
  if (!consolidationResult.value) return
  const url = await templatesStore.getDownloadUrl(consolidationResult.value.consolidated_sheet_id)
  window.open(url, '_blank')
}

function onFinetuneApplied() {
  templatesStore.fetchConsolidatedSheets(templateId)
}
</script>
```

Keep the `<template>` block unchanged.

- **Step 2: Type-check**

```bash
cd frontend && npm run type-check 2>&1 | grep ConsolidationDashboard
```

- **Step 3: Commit**

```bash
git add frontend/src/views/admin/ConsolidationDashboardView.vue
git commit -m "feat: migrate ConsolidationDashboardView to FastAPI"
```

---

### Task 21: Remove Supabase dependency

- **Step 1: Delete `frontend/src/lib/supabase.ts`**

```bash
rm frontend/src/lib/supabase.ts
```

- **Step 2: Verify no remaining Supabase imports**

```bash
grep -r "supabase" frontend/src/ --include="*.ts" --include="*.vue"
```

Expected: no output.

- **Step 3: Remove @supabase/supabase-js from package.json**

```bash
cd frontend && npm uninstall @supabase/supabase-js
```

- **Step 4: Full type-check**

```bash
cd frontend && npm run type-check
```

Expected: no errors.

- **Step 5: Lint check**

```bash
cd frontend && npm run lint
```

- **Step 6: Run unit tests**

```bash
cd frontend && npm run test
```

- **Step 7: Commit**

```bash
git add frontend/src/lib/supabase.ts frontend/package.json frontend/package-lock.json
git commit -m "chore: remove Supabase dependency"
```

---

### Task 22: Final verification

- **Step 1: Start backend and verify routes are registered**

```bash
cd backend && uvicorn app.main:app --reload --port 8000
```

Open `http://localhost:8000/docs` — verify these routes exist:

- `GET /api/organizations`
- `POST /api/organizations`
- `GET /api/admin/users`
- `PATCH /api/admin/users/{user_id}/role`
- `GET /api/templates`
- `POST /api/templates`
- `GET /api/templates/{template_id}`
- `POST /api/templates/{template_id}/versions`
- `PATCH /api/templates/{template_id}/status`
- `GET /api/templates/{template_id}/consolidations`
- `GET /api/templates/consolidations/{sheet_id}/download`
- `POST /api/assignments`
- `POST /api/ai/parse-template`
- `POST /api/ai/template-generate`
- `POST /api/ai/finetune`
- **Step 2: Start frontend**

```bash
cd frontend && npm run dev
```

- **Step 3: Log in and navigate to `/admin/templates`** — verify the template list loads without console errors.
- **Step 4: Run full backend test suite one last time**

```bash
cd backend && pytest --cov=app -v
```

- **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: migration complete — all Supabase references removed"
```

