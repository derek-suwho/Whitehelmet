# PIF QHSE Platform Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve Whitehelmet from a single-user Excel tool into a multi-tenant QHSE KPI reporting platform where PIF creates templates, assigns them to DevCos, DevCos submit data, and PIF consolidates with formula-based calculations.

**Architecture:** Three-layer build — (1) multi-tenant foundation with orgs/roles/RBAC, (2) template engine for PIF to create versioned KPI templates with formulas, (3) submission + consolidation pipeline where DevCos fill templates and PIF generates master KPI sheets. Dev-bypass auth endpoints unblock parallel development while Keycloak integration is finalized.

**Tech Stack:** FastAPI + SQLAlchemy + MySQL (backend), Vue 3 + TypeScript + Pinia (frontend), openpyxl (xlsx parsing), Python `ast` module (safe formula eval), pytest (backend tests), Vitest (frontend tests)

---

## File Map

### Backend — New Files
| File | Responsibility |
|------|---------------|
| `backend/app/models/organization.py` | Org table (pif/devco types, parent_org_id) |
| `backend/app/models/template.py` | Top-level template record |
| `backend/app/models/template_version.py` | Versioned schema_json snapshots |
| `backend/app/models/formula.py` | Formulas scoped to a template version |
| `backend/app/models/template_assignment.py` | Which orgs receive which template versions |
| `backend/app/models/submission.py` | DevCo-submitted data (locked on submit) |
| `backend/app/models/calculated_result.py` | Per-formula results stored after submit |
| `backend/app/models/consolidated_sheet.py` | Generated master .xlsx binaries |
| `backend/app/schemas/templates.py` | Template + version + assignment Pydantic schemas |
| `backend/app/schemas/formulas.py` | Formula CRUD schemas |
| `backend/app/schemas/submissions.py` | Submission + calculated result schemas |
| `backend/app/schemas/admin.py` | User/org admin CRUD schemas |
| `backend/app/api/routes/admin.py` | PIF admin org/user management endpoints |
| `backend/app/api/routes/templates.py` | Template CRUD + import + assignment endpoints |
| `backend/app/api/routes/formulas.py` | Formula CRUD scoped to template version |
| `backend/app/api/routes/submissions.py` | Submit, save draft, review endpoints |
| `backend/app/api/routes/consolidations.py` | Trigger consolidation, download master sheet |
| `backend/app/services/template_import.py` | Parse .xlsx → TemplateImportPreview (no DB) |
| `backend/app/services/formula_engine.py` | Execute formulas against submission data_json |
| `backend/app/services/consolidation.py` | Build master .xlsx from all submissions |

### Backend — Modified Files
| File | Change |
|------|--------|
| `backend/app/models/user.py` | Add `org_id` FK, `role` enum column |
| `backend/app/schemas/auth.py` | Add `role`, `org_id` to UserResponse |
| `backend/app/core/dependencies.py` | Add `require_role()` dependency factory |
| `backend/app/api/routes/auth.py` | Add dev-login bypass endpoints; wire Keycloak stub |
| `backend/app/api/routes/records.py` | Scope queries by `user.org_id` |
| `backend/app/api/routes/files.py` | Scope queries by `user.org_id` |
| `backend/app/main.py` | Register all new routers |

### Frontend — New Files
| File | Responsibility |
|------|---------------|
| `frontend/src/stores/templates.ts` | Template list, current template, formulas, assignments |
| `frontend/src/stores/submissions.ts` | DevCo draft + submission list + auto-save |
| `frontend/src/components/AdminLayout.vue` | PIF admin shell with sidebar nav |
| `frontend/src/components/templates/ImportTemplateModal.vue` | 2-step xlsx upload + preview modal |
| `frontend/src/components/templates/AssignmentModal.vue` | Assign template to org(s) modal |
| `frontend/src/views/admin/TemplateListView.vue` | PIF template list (draft/active/deprecated) |
| `frontend/src/views/admin/TemplateBuilderView.vue` | Template + formula builder (columns tab + formulas tab) |
| `frontend/src/views/admin/TemplateDetailView.vue` | Template version history + assignment tab |
| `frontend/src/views/admin/ConsolidationDashboardView.vue` | Status matrix + generate master sheet |
| `frontend/src/views/admin/UserManagementView.vue` | User table + create/role-change |
| `frontend/src/views/admin/OrganizationListView.vue` | Org list + create org |
| `frontend/src/views/TemplateListView.vue` | DevCo assigned templates + submission status |
| `frontend/src/views/SubmissionFormView.vue` | Fillable spreadsheet + submit confirmation |
| `frontend/src/views/SubmissionListView.vue` | DevCo submission history + read-only view |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `frontend/src/stores/auth.ts` | Add `role`, `org_id`, `isAdmin`, `orgType` |
| `frontend/src/router/index.ts` | Add all new routes + role-based guards |

---

## Chunk 1: Multi-tenant Foundation

### Task 1: Organization model

**Files:**
- Create: `backend/app/models/organization.py`
- Modify: `backend/app/models/__init__.py` (add import)

- [ ] Create `backend/app/models/organization.py`:

```python
import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Enum, ForeignKey, DateTime
from app.db.session import Base

class OrgType(str, enum.Enum):
    pif = "pif"
    devco = "devco"

class Organization(Base):
    __tablename__ = "organizations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    type = Column(Enum(OrgType), nullable=False)
    parent_org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
```

- [ ] Add `from app.models.organization import Organization` to `backend/app/models/__init__.py` (or wherever models are imported in `main.py`/`migrations/env.py`)

- [ ] Start backend and verify table creation:
```bash
cd backend && python -c "from app.models.organization import Organization; print('OK')"
```

- [ ] Commit:
```bash
git add backend/app/models/organization.py
git commit -m "add Organization model"
```

---

### Task 2: Add org_id and role to User model

**Files:**
- Modify: `backend/app/models/user.py`

- [ ] Write failing test:

```python
# backend/tests/test_user_model.py
def test_user_has_role_and_org():
    from app.models.user import User, UserRole
    u = User()
    assert hasattr(u, 'role')
    assert hasattr(u, 'org_id')
    assert 'pif_admin' in [r.value for r in UserRole]
    assert 'devco_admin' in [r.value for r in UserRole]
    assert 'devco_user' in [r.value for r in UserRole]
```

- [ ] Run: `cd backend && pytest tests/test_user_model.py -v` — expect FAIL

- [ ] Add to `backend/app/models/user.py`:

```python
import enum
# add to existing imports
from sqlalchemy import Enum as SAEnum, ForeignKey

class UserRole(str, enum.Enum):
    pif_admin = "pif_admin"
    devco_admin = "devco_admin"
    devco_user = "devco_user"

# Add inside User class:
role = Column(SAEnum(UserRole), nullable=True)
org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
```

- [ ] Run: `cd backend && pytest tests/test_user_model.py -v` — expect PASS

- [ ] Commit:
```bash
git add backend/app/models/user.py backend/tests/test_user_model.py
git commit -m "add role and org_id to User"
```

---

### Task 3: Update UserResponse schema + add require_role dependency

**Files:**
- Modify: `backend/app/schemas/auth.py`
- Modify: `backend/app/core/dependencies.py`

- [ ] Write failing test:

```python
# backend/tests/test_dependencies.py
def test_require_role_factory():
    from app.core.dependencies import require_role
    dep = require_role("pif_admin")
    assert callable(dep)
```

- [ ] Run: `cd backend && pytest tests/test_dependencies.py -v` — expect FAIL

- [ ] Add to `backend/app/schemas/auth.py`:

```python
# In UserResponse:
role: str | None = None
org_id: int | None = None
```

- [ ] Add to `backend/app/core/dependencies.py`:

```python
from typing import List
from fastapi import HTTPException, status

def require_role(*allowed_roles: str):
    """Factory returning a FastAPI dependency that enforces role access."""
    async def dependency(current_user=Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' not permitted. Required: {list(allowed_roles)}"
            )
        return current_user
    return dependency
```

- [ ] Run: `cd backend && pytest tests/test_dependencies.py -v` — expect PASS

- [ ] Commit:
```bash
git add backend/app/schemas/auth.py backend/app/core/dependencies.py backend/tests/test_dependencies.py
git commit -m "add require_role dep and UserResponse role fields"
```

---

### Task 4: Dev-login bypass endpoints

**Files:**
- Modify: `backend/app/api/routes/auth.py`

- [ ] Write failing test:

```python
# backend/tests/test_auth_routes.py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_dev_login_pif_admin(db_with_seed):
    resp = client.get("/api/auth/dev-login/pif_admin")
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "pif_admin"

def test_dev_login_devco_user(db_with_seed):
    resp = client.get("/api/auth/dev-login/devco_user")
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "devco_user"
```

- [ ] Run test — expect FAIL (routes don't exist)

- [ ] Add to `backend/app/api/routes/auth.py` (dev-only, gated by `settings.environment == "dev"`):

```python
@router.get("/dev-login/{role}", include_in_schema=False)
async def dev_login(role: str, db: Session = Depends(get_db), response: Response = None):
    """DEV ONLY — returns a hardcoded session for the requested role. Remove before staging."""
    from app.core.config import settings
    if settings.environment != "dev":
        raise HTTPException(status_code=404)

    # Seed org + user if missing
    pif_org = db.query(Organization).filter_by(type="pif").first()
    if not pif_org:
        pif_org = Organization(name="PIF", type="pif")
        db.add(pif_org)
        devco_org = Organization(name="NEOM", type="devco", parent_org_id=None)
        db.add(devco_org)
        db.commit()
        db.refresh(pif_org)

    devco_org = db.query(Organization).filter_by(type="devco").first()
    role_to_org = {
        "pif_admin": (pif_org.id, "pif_admin"),
        "devco_admin": (devco_org.id, "devco_admin"),
        "devco_user": (devco_org.id, "devco_user"),
    }
    if role not in role_to_org:
        raise HTTPException(status_code=400, detail="Unknown role")

    org_id, user_role = role_to_org[role]
    user = db.query(User).filter_by(external_id=f"dev_{role}").first()
    if not user:
        user = User(external_id=f"dev_{role}", email=f"{role}@dev.local",
                    display_name=f"Dev {role}", role=user_role, org_id=org_id)
        db.add(user)
        db.commit()
        db.refresh(user)

    token = generate_session_token()
    session = SessionModel(token=token, user_id=user.id, expires_at=session_expiry())
    db.add(session)
    db.commit()

    csrf = generate_csrf_token(token)
    response.set_cookie("session_id", token, httponly=True, samesite="lax")
    return {"role": user.role, "org_id": user.org_id, "csrf_token": csrf,
            "email": user.email, "display_name": user.display_name}
```

- [ ] Run tests — expect PASS

- [ ] Commit:
```bash
git add backend/app/api/routes/auth.py backend/tests/test_auth_routes.py
git commit -m "add dev-login bypass endpoints"
```

---

### Task 5: Admin org/user management routes

**Files:**
- Create: `backend/app/api/routes/admin.py`
- Create: `backend/app/schemas/admin.py`

- [ ] Create `backend/app/schemas/admin.py`:

```python
from pydantic import BaseModel
from typing import Optional, List
from app.models.organization import OrgType
from app.models.user import UserRole

class OrgCreate(BaseModel):
    name: str
    type: OrgType = OrgType.devco
    parent_org_id: Optional[int] = None

class OrgResponse(BaseModel):
    id: int
    name: str
    type: str
    parent_org_id: Optional[int]
    user_count: int = 0
    model_config = {"from_attributes": True}

class UserCreate(BaseModel):
    external_id: str
    email: str
    display_name: str
    org_id: int
    role: UserRole

class UserAdminResponse(BaseModel):
    id: int
    email: str
    display_name: str
    role: Optional[str]
    org_id: Optional[int]
    model_config = {"from_attributes": True}

class RoleUpdate(BaseModel):
    role: UserRole
```

- [ ] Create `backend/app/api/routes/admin.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.dependencies import require_role
from app.models.organization import Organization
from app.models.user import User
from app.schemas.admin import OrgCreate, OrgResponse, UserCreate, UserAdminResponse, RoleUpdate
from typing import List, Optional

router = APIRouter(prefix="/api/admin", tags=["admin"])
pif_only = Depends(require_role("pif_admin"))

@router.post("/organizations", response_model=OrgResponse, dependencies=[pif_only])
def create_org(body: OrgCreate, db: Session = Depends(get_db)):
    org = Organization(**body.model_dump())
    db.add(org); db.commit(); db.refresh(org)
    return {**org.__dict__, "user_count": 0}

@router.get("/organizations", response_model=List[OrgResponse], dependencies=[pif_only])
def list_orgs(db: Session = Depends(get_db)):
    orgs = db.query(Organization).all()
    return [{**o.__dict__, "user_count": db.query(User).filter_by(org_id=o.id).count()} for o in orgs]

@router.post("/users", response_model=UserAdminResponse, dependencies=[pif_only])
def create_user(body: UserCreate, db: Session = Depends(get_db)):
    user = User(**body.model_dump())
    db.add(user); db.commit(); db.refresh(user)
    return user

@router.get("/users", response_model=List[UserAdminResponse], dependencies=[pif_only])
def list_users(org_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(User)
    if org_id: q = q.filter_by(org_id=org_id)
    return q.all()

@router.put("/users/{user_id}/role", response_model=UserAdminResponse, dependencies=[pif_only])
def update_role(user_id: int, body: RoleUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(id=user_id).first()
    if not user: raise HTTPException(404)
    user.role = body.role
    db.commit(); db.refresh(user)
    return user
```

- [ ] Write test:

```python
# backend/tests/test_admin_routes.py
def test_create_org_requires_pif_admin(client_devco):
    resp = client_devco.post("/api/admin/organizations", json={"name": "Test", "type": "devco"})
    assert resp.status_code == 403

def test_create_org_as_pif_admin(client_pif):
    resp = client_pif.post("/api/admin/organizations", json={"name": "TestOrg", "type": "devco"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "TestOrg"
```

- [ ] Register router in `backend/app/main.py`:
```python
from app.api.routes.admin import router as admin_router
app.include_router(admin_router)
```

- [ ] Run: `cd backend && pytest tests/test_admin_routes.py -v`

- [ ] Commit:
```bash
git add backend/app/api/routes/admin.py backend/app/schemas/admin.py backend/app/main.py backend/tests/test_admin_routes.py
git commit -m "add admin org/user management routes"
```

---

### Task 6: Frontend auth store + role guards

**Files:**
- Modify: `frontend/src/stores/auth.ts`
- Modify: `frontend/src/router/index.ts`

- [ ] Update `auth.ts` — add to `AuthUser` interface and store:

```typescript
interface AuthUser {
  id: number
  email: string
  display_name: string
  role: 'pif_admin' | 'devco_admin' | 'devco_user' | null
  org_id: number | null
}

// Add computed in store:
const isAdmin = computed(() => user.value?.role === 'pif_admin')
const orgType = computed(() => user.value?.role === 'pif_admin' ? 'pif' : 'devco')
```

- [ ] Update `router/index.ts` — add route meta and guard:

```typescript
// Route meta type
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresRole?: 'pif_admin' | 'devco_admin' | 'devco_user'
  }
}

// In beforeEach guard, add after auth check:
if (to.meta.requiresRole && user.role !== to.meta.requiresRole) {
  return user.role === 'pif_admin' ? '/admin/templates' : '/templates'
}
```

- [ ] Add placeholder routes (empty components for now):

```typescript
// Admin routes
{ path: '/admin/templates', component: () => import('../views/admin/TemplateListView.vue'), meta: { requiresAuth: true, requiresRole: 'pif_admin' } },
{ path: '/admin/templates/new', component: () => import('../views/admin/TemplateBuilderView.vue'), meta: { requiresAuth: true, requiresRole: 'pif_admin' } },
{ path: '/admin/templates/:id', component: () => import('../views/admin/TemplateDetailView.vue'), meta: { requiresAuth: true, requiresRole: 'pif_admin' } },
{ path: '/admin/consolidations', component: () => import('../views/admin/ConsolidationDashboardView.vue'), meta: { requiresAuth: true, requiresRole: 'pif_admin' } },
{ path: '/admin/users', component: () => import('../views/admin/UserManagementView.vue'), meta: { requiresAuth: true, requiresRole: 'pif_admin' } },
{ path: '/admin/organizations', component: () => import('../views/admin/OrganizationListView.vue'), meta: { requiresAuth: true, requiresRole: 'pif_admin' } },
// DevCo routes
{ path: '/templates', component: () => import('../views/TemplateListView.vue'), meta: { requiresAuth: true } },
{ path: '/submissions', component: () => import('../views/SubmissionListView.vue'), meta: { requiresAuth: true } },
{ path: '/submissions/new', component: () => import('../views/SubmissionFormView.vue'), meta: { requiresAuth: true } },
{ path: '/submissions/:id', component: () => import('../views/SubmissionFormView.vue'), meta: { requiresAuth: true } },
```

- [ ] Create stub views for each new route (single `<template><div>{{ $route.path }}</div></template>`) so router doesn't error

- [ ] Commit:
```bash
git add frontend/src/stores/auth.ts frontend/src/router/index.ts frontend/src/views/
git commit -m "add role guards and stub views for new routes"
```

---

### Task 7: Admin layout + User Management view

**Files:**
- Create: `frontend/src/components/AdminLayout.vue`
- Create: `frontend/src/views/admin/UserManagementView.vue`
- Create: `frontend/src/views/admin/OrganizationListView.vue`

- [ ] Create `AdminLayout.vue` with sidebar:

```vue
<template>
  <div class="flex h-screen">
    <nav class="w-56 bg-gray-900 text-white flex flex-col p-4 gap-2">
      <div class="text-sm font-semibold text-gray-400 mb-2">PIF Admin</div>
      <RouterLink v-for="link in nav" :key="link.to" :to="link.to"
        class="px-3 py-2 rounded hover:bg-gray-700 text-sm"
        :class="{ 'bg-gray-700': $route.path.startsWith(link.to) }">
        {{ link.label }}
      </RouterLink>
    </nav>
    <main class="flex-1 overflow-auto p-6">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const nav = [
  { to: '/admin/templates', label: 'Templates' },
  { to: '/admin/consolidations', label: 'Consolidations' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/organizations', label: 'Organisations' },
]
</script>
```

- [ ] Create `UserManagementView.vue` — table with columns: Name, Email, Org, Role, Actions (change role); button "New User" opens a form modal

- [ ] Create `OrganizationListView.vue` — table with columns: Name, Type, User Count; button "New Org" opens inline form

- [ ] Commit:
```bash
git add frontend/src/components/AdminLayout.vue frontend/src/views/admin/
git commit -m "add admin layout, user and org management views"
```

---

## Chunk 2: Template Engine

### Task 8: Template + TemplateVersion + Formula + TemplateAssignment models

**Files:**
- Create: `backend/app/models/template.py`
- Create: `backend/app/models/template_version.py`
- Create: `backend/app/models/formula.py`
- Create: `backend/app/models/template_assignment.py`

- [ ] Create `backend/app/models/template.py`:

```python
import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Enum, Text, DateTime, ForeignKey
from app.db.session import Base

class TemplateStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    deprecated = "deprecated"

class Template(Base):
    __tablename__ = "templates"
    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(TemplateStatus), default=TemplateStatus.draft, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

- [ ] Create `backend/app/models/template_version.py`:

```python
from datetime import datetime
from sqlalchemy import Column, Integer, ForeignKey, DateTime, JSON
from app.db.session import Base

class TemplateVersion(Base):
    __tablename__ = "template_versions"
    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    schema_json = Column(JSON, nullable=False)
    published_at = Column(DateTime, nullable=True)
```

- [ ] Create `backend/app/models/formula.py`:

```python
import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, JSON, Enum, ForeignKey, DateTime
from app.db.session import Base

class FormulaScope(str, enum.Enum):
    quality = "quality"
    hse = "hse"
    general = "general"

class Formula(Base):
    __tablename__ = "formulas"
    id = Column(Integer, primary_key=True, index=True)
    template_version_id = Column(Integer, ForeignKey("template_versions.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    expression = Column(Text, nullable=False)
    scoring_rules = Column(JSON, nullable=True)
    scope = Column(Enum(FormulaScope), default=FormulaScope.general)
    display_order = Column(Integer, default=0)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
```

- [ ] Create `backend/app/models/template_assignment.py`:

```python
from datetime import datetime
from sqlalchemy import Column, Integer, ForeignKey, DateTime
from app.db.session import Base

class TemplateAssignment(Base):
    __tablename__ = "template_assignments"
    id = Column(Integer, primary_key=True, index=True)
    template_version_id = Column(Integer, ForeignKey("template_versions.id"), nullable=False)
    assignee_org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)  # null = all orgs
    assigned_at = Column(DateTime, default=datetime.utcnow)
```

- [ ] Commit:
```bash
git add backend/app/models/template.py backend/app/models/template_version.py backend/app/models/formula.py backend/app/models/template_assignment.py
git commit -m "add template, version, formula, assignment models"
```

---

### Task 9: Template import service

**Files:**
- Create: `backend/app/services/template_import.py`

- [ ] Write failing test:

```python
# backend/tests/test_template_import.py
import openpyxl, io
from app.services.template_import import parse_template_xlsx

def make_xlsx(headers, rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(headers)
    for row in rows: ws.append(row)
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    return buf.read()

def test_basic_parse():
    data = make_xlsx(
        ["Level_1", "Level_2", "Total_Manhours", "Comments"],
        [["NEOM", "Sindalah", 1000000, "ok"], ["NEOM", "THE LINE", 500000, "fine"]]
    )
    preview = parse_template_xlsx(data, filename="HSE_Report.xlsx")
    assert preview.suggested_name == "HSE Report"
    assert preview.submission_mode == "multi_row"
    col_names = [c.name for c in preview.columns]
    assert "Level_1" in col_names
    assert "Total_Manhours" in col_names
    # Level_1 is identifier
    level1 = next(c for c in preview.columns if c.name == "Level_1")
    assert level1.identifier is True
    # Total_Manhours is number with min:0
    manhours = next(c for c in preview.columns if c.name == "Total_Manhours")
    assert manhours.type == "number"
    assert manhours.validation == {"min": 0}

def test_single_row_mode():
    data = make_xlsx(["KPI", "Value"], [["TRIR", 1.5]])
    preview = parse_template_xlsx(data, filename="single.xlsx")
    assert preview.submission_mode == "single_row"
```

- [ ] Run: `cd backend && pytest tests/test_template_import.py -v` — expect FAIL

- [ ] Create `backend/app/services/template_import.py`:

```python
import io, re
from typing import Literal, Optional
import openpyxl
from pydantic import BaseModel

class TemplateImportPreviewColumn(BaseModel):
    name: str
    type: Literal["text", "number", "date", "percentage"]
    required: bool
    identifier: bool
    validation: dict | None = None

class TemplateImportPreview(BaseModel):
    suggested_name: str
    sheet_name: str
    available_sheets: list[str]
    submission_mode: Literal["single_row", "multi_row"]
    columns: list[TemplateImportPreviewColumn]
    sample_rows: list[dict]

def _suggest_name(filename: str) -> str:
    name = filename.rsplit(".", 1)[0]
    name = re.sub(r"[-_]", " ", name)
    return name.title()

def _infer_type(values: list) -> str:
    non_blank = [v for v in values if v is not None and v != ""]
    if not non_blank:
        return "text"
    for v in non_blank:
        try:
            float(v)
        except (ValueError, TypeError):
            return "text"
    return "number"

def _is_identifier(name: str, values: list) -> bool:
    if re.match(r"level_\d+", name.lower()):
        return True
    non_blank = [v for v in values if v is not None]
    if all(isinstance(v, str) for v in non_blank) and len(set(non_blank)) <= 5:
        return True
    return False

def parse_template_xlsx(data: bytes, filename: str, sheet_name: str | None = None) -> TemplateImportPreview:
    wb = openpyxl.load_workbook(io.BytesIO(data), data_only=True)
    available_sheets = wb.sheetnames
    ws = wb[sheet_name] if sheet_name and sheet_name in wb.sheetnames else wb.active

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return TemplateImportPreview(
            suggested_name=_suggest_name(filename), sheet_name=ws.title,
            available_sheets=available_sheets, submission_mode="single_row",
            columns=[], sample_rows=[]
        )

    headers = [str(h).strip() for h in rows[0] if h is not None]
    data_rows = rows[1:21]  # up to 20

    col_values = {h: [] for h in headers}
    for row in data_rows:
        for i, h in enumerate(headers):
            col_values[h].append(row[i] if i < len(row) else None)

    columns = []
    for h in headers:
        vals = col_values[h]
        col_type = _infer_type(vals)
        identifier = _is_identifier(h, vals)
        validation = None
        if col_type == "number":
            non_blank = [float(v) for v in vals if v is not None and v != ""]
            if non_blank and all(v >= 0 for v in non_blank):
                validation = {"min": 0}
        columns.append(TemplateImportPreviewColumn(
            name=h, type=col_type, required=True, identifier=identifier, validation=validation
        ))

    sample_rows = []
    for row in data_rows[:3]:
        sample_rows.append({headers[i]: row[i] for i in range(len(headers)) if i < len(row)})

    mode = "multi_row" if len(data_rows) > 1 else "single_row"

    return TemplateImportPreview(
        suggested_name=_suggest_name(filename),
        sheet_name=ws.title,
        available_sheets=available_sheets,
        submission_mode=mode,
        columns=columns,
        sample_rows=sample_rows
    )
```

- [ ] Run: `cd backend && pytest tests/test_template_import.py -v` — expect PASS

- [ ] Commit:
```bash
git add backend/app/services/template_import.py backend/tests/test_template_import.py
git commit -m "add template import service with xlsx parsing"
```

---

### Task 10: Template and formula Pydantic schemas

**Files:**
- Create: `backend/app/schemas/templates.py`
- Create: `backend/app/schemas/formulas.py`

- [ ] Create `backend/app/schemas/templates.py`:

```python
from pydantic import BaseModel
from typing import Optional, List, Literal
from datetime import datetime

class ColumnSchema(BaseModel):
    name: str
    type: Literal["text", "number", "date", "percentage"]
    required: bool
    identifier: bool = False
    validation: dict | None = None

class TemplateVersionSchema(BaseModel):
    submission_mode: Literal["single_row", "multi_row"] = "multi_row"
    columns: List[ColumnSchema]

class TemplateCreate(BaseModel):
    name: str
    description: str | None = None

class TemplateVersionCreate(BaseModel):
    schema_json: TemplateVersionSchema

class TemplateAssignRequest(BaseModel):
    org_ids: List[int] | None = None  # None = assign to all

class FormulaInVersion(BaseModel):
    id: int
    name: str
    expression: str
    scoring_rules: list | None = None
    scope: str
    display_order: int
    model_config = {"from_attributes": True}

class TemplateVersionResponse(BaseModel):
    id: int
    version_number: int
    schema_json: dict
    published_at: datetime | None
    formulas: List[FormulaInVersion] = []
    model_config = {"from_attributes": True}

class TemplateResponse(BaseModel):
    id: int
    name: str
    description: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    current_version: TemplateVersionResponse | None = None
    model_config = {"from_attributes": True}

class TemplateListResponse(BaseModel):
    templates: List[TemplateResponse]
    total: int
```

- [ ] Create `backend/app/schemas/formulas.py`:

```python
from pydantic import BaseModel
from typing import Optional, List

class FormulaCreate(BaseModel):
    name: str
    description: str | None = None
    expression: str
    scoring_rules: list | None = None
    scope: str = "general"
    display_order: int = 0

class FormulaUpdate(BaseModel):
    name: str | None = None
    expression: str | None = None
    scoring_rules: list | None = None
    scope: str | None = None
    display_order: int | None = None

class FormulaResponse(BaseModel):
    id: int
    name: str
    expression: str
    scoring_rules: list | None
    scope: str
    display_order: int
    model_config = {"from_attributes": True}
```

- [ ] Commit:
```bash
git add backend/app/schemas/templates.py backend/app/schemas/formulas.py
git commit -m "add template and formula schemas"
```

---

### Task 11: Template and formula API routes

**Files:**
- Create: `backend/app/api/routes/templates.py`
- Create: `backend/app/api/routes/formulas.py`

- [ ] Create `backend/app/api/routes/templates.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.core.dependencies import require_role, get_current_user
from app.models.template import Template, TemplateStatus
from app.models.template_version import TemplateVersion
from app.models.formula import Formula
from app.models.template_assignment import TemplateAssignment
from app.schemas.templates import (TemplateCreate, TemplateResponse, TemplateVersionCreate,
                                    TemplateAssignRequest, TemplateListResponse)
from app.services.template_import import parse_template_xlsx

router = APIRouter(prefix="/api/templates", tags=["templates"])

@router.post("", response_model=TemplateResponse)
def create_template(body: TemplateCreate, db: Session = Depends(get_db),
                    current_user=Depends(require_role("pif_admin"))):
    t = Template(name=body.name, description=body.description,
                 org_id=current_user.org_id, created_by=current_user.id)
    db.add(t); db.commit(); db.refresh(t)
    return _template_response(t, db)

@router.get("", response_model=TemplateListResponse)
def list_templates(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role == "pif_admin":
        templates = db.query(Template).all()
        return {"templates": [_template_response(t, db) for t in templates], "total": len(templates)}
    else:
        # DevCo: only assigned templates + current-period submission status
        assigned_version_ids = (db.query(TemplateAssignment.template_version_id)
            .filter((TemplateAssignment.assignee_org_id == current_user.org_id) |
                    (TemplateAssignment.assignee_org_id == None)).all())
        vid_set = {r[0] for r in assigned_version_ids}
        version_template_ids = (db.query(TemplateVersion.template_id)
            .filter(TemplateVersion.id.in_(vid_set)).all())
        tid_set = {r[0] for r in version_template_ids}
        templates = db.query(Template).filter(Template.id.in_(tid_set)).all()
        from datetime import datetime
        current_period = datetime.utcnow().strftime("%Y-%m")
        result = []
        for t in templates:
            tr = _template_response(t, db)
            cv = tr.get("current_version")
            if cv:
                sub = (db.query(Submission)
                       .filter_by(template_version_id=cv["id"],
                                  submitter_org_id=current_user.org_id,
                                  period=current_period)
                       .order_by(Submission.id.desc()).first())
                tr["submission_status"] = sub.status if sub else "not_started"
                tr["submission_id"] = sub.id if sub else None
            else:
                tr["submission_status"] = "not_started"
                tr["submission_id"] = None
            result.append(tr)
        return {"templates": result, "total": len(result)}

@router.get("/{template_id}", response_model=TemplateResponse)
def get_template(template_id: int, db: Session = Depends(get_db),
                 current_user=Depends(get_current_user)):
    t = db.query(Template).filter_by(id=template_id).first()
    if not t: raise HTTPException(404)
    return _template_response(t, db)

@router.post("/{template_id}/versions", response_model=TemplateResponse)
def publish_version(template_id: int, body: TemplateVersionCreate,
                    db: Session = Depends(get_db),
                    current_user=Depends(require_role("pif_admin"))):
    t = db.query(Template).filter_by(id=template_id).first()
    if not t: raise HTTPException(404)
    last = (db.query(TemplateVersion).filter_by(template_id=template_id)
            .order_by(TemplateVersion.version_number.desc()).first())
    version_num = (last.version_number + 1) if last else 1
    from datetime import datetime
    tv = TemplateVersion(template_id=template_id, version_number=version_num,
                         schema_json=body.schema_json.model_dump(), published_at=datetime.utcnow())
    db.add(tv); db.commit(); db.refresh(tv)
    return _template_response(t, db)

@router.put("/{template_id}/status")
def update_status(template_id: int, status: TemplateStatus, db: Session = Depends(get_db),
                  current_user=Depends(require_role("pif_admin"))):
    t = db.query(Template).filter_by(id=template_id).first()
    if not t: raise HTTPException(404)
    t.status = status; db.commit()
    return {"status": status}

@router.post("/{template_id}/assign")
def assign_template(template_id: int, body: TemplateAssignRequest,
                    db: Session = Depends(get_db),
                    current_user=Depends(require_role("pif_admin"))):
    t = db.query(Template).filter_by(id=template_id).first()
    if not t: raise HTTPException(404)
    tv = (db.query(TemplateVersion).filter_by(template_id=template_id)
          .order_by(TemplateVersion.version_number.desc()).first())
    if not tv: raise HTTPException(400, "No version to assign")
    if body.org_ids is None:
        db.add(TemplateAssignment(template_version_id=tv.id, assignee_org_id=None))
    else:
        for oid in body.org_ids:
            db.add(TemplateAssignment(template_version_id=tv.id, assignee_org_id=oid))
    db.commit()
    return {"assigned": True}

@router.post("/import/parse")
async def import_parse(file: UploadFile = File(...), sheet_name: Optional[str] = Form(None),
                       current_user=Depends(require_role("pif_admin"))):
    content = await file.read()
    return parse_template_xlsx(content, filename=file.filename, sheet_name=sheet_name)

class ImportConfirmRequest(BaseModel):
    name: str
    schema_json: dict  # TemplateVersionSchema-shaped

@router.post("/import/confirm", response_model=TemplateResponse)
def import_confirm(body: ImportConfirmRequest, db: Session = Depends(get_db),
                   current_user=Depends(require_role("pif_admin"))):
    t = Template(name=body.name, org_id=current_user.org_id, created_by=current_user.id)
    db.add(t); db.commit(); db.refresh(t)
    tv = TemplateVersion(template_id=t.id, version_number=1,
                         schema_json=body.schema_json, published_at=None)
    db.add(tv); db.commit(); db.refresh(tv)
    return _template_response(t, db)

@router.get("/{template_id}/assignments", dependencies=[Depends(require_role("pif_admin"))])
def list_assignments(template_id: int, db: Session = Depends(get_db)):
    tv = (db.query(TemplateVersion).filter_by(template_id=template_id)
          .order_by(TemplateVersion.version_number.desc()).first())
    if not tv: return []
    assignments = db.query(TemplateAssignment).filter_by(template_version_id=tv.id).all()
    return [{"id": a.id, "assignee_org_id": a.assignee_org_id, "assigned_at": a.assigned_at}
            for a in assignments]

def _template_response(t: Template, db: Session) -> dict:
    tv = (db.query(TemplateVersion).filter_by(template_id=t.id)
          .order_by(TemplateVersion.version_number.desc()).first())
    current_version = None
    if tv:
        formulas = db.query(Formula).filter_by(template_version_id=tv.id).order_by(Formula.display_order).all()
        assignments = db.query(TemplateAssignment).filter_by(template_version_id=tv.id).all()
        current_version = {
            "id": tv.id, "version_number": tv.version_number,
            "schema_json": tv.schema_json, "published_at": tv.published_at,
            "formulas": [{"id": f.id, "name": f.name, "expression": f.expression,
                          "scoring_rules": f.scoring_rules, "scope": f.scope,
                          "display_order": f.display_order} for f in formulas],
            "assignments": [{"id": a.id, "assignee_org_id": a.assignee_org_id,
                             "assigned_at": a.assigned_at} for a in assignments],
        }
    return {"id": t.id, "name": t.name, "description": t.description, "status": t.status,
            "created_at": t.created_at, "updated_at": t.updated_at, "current_version": current_version}
```

- [ ] Create `backend/app/api/routes/formulas.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.dependencies import require_role
from app.models.formula import Formula
from app.models.template import Template
from app.models.template_version import TemplateVersion
from app.schemas.formulas import FormulaCreate, FormulaUpdate, FormulaResponse
from typing import List

router = APIRouter(prefix="/api/templates", tags=["formulas"])

def _get_draft_version(template_id: int, db: Session) -> TemplateVersion:
    t = db.query(Template).filter_by(id=template_id).first()
    if not t: raise HTTPException(404, "Template not found")
    tv = (db.query(TemplateVersion).filter_by(template_id=template_id)
          .order_by(TemplateVersion.version_number.desc()).first())
    if not tv or tv.published_at is not None:
        raise HTTPException(400, "No unpublished draft version. Publish a new version first.")
    return tv

@router.post("/{template_id}/formulas", response_model=FormulaResponse)
def add_formula(template_id: int, body: FormulaCreate, db: Session = Depends(get_db),
                current_user=Depends(require_role("pif_admin"))):
    tv = _get_draft_version(template_id, db)
    f = Formula(**body.model_dump(), template_version_id=tv.id, created_by=current_user.id)
    db.add(f); db.commit(); db.refresh(f)
    return f

@router.get("/{template_id}/formulas", response_model=List[FormulaResponse])
def list_formulas(template_id: int, db: Session = Depends(get_db),
                  current_user=Depends(require_role("pif_admin"))):
    tv = (db.query(TemplateVersion).filter_by(template_id=template_id)
          .order_by(TemplateVersion.version_number.desc()).first())
    if not tv: return []
    return db.query(Formula).filter_by(template_version_id=tv.id).order_by(Formula.display_order).all()

@router.put("/{template_id}/formulas/{formula_id}", response_model=FormulaResponse)
def update_formula(template_id: int, formula_id: int, body: FormulaUpdate,
                   db: Session = Depends(get_db), current_user=Depends(require_role("pif_admin"))):
    tv = _get_draft_version(template_id, db)
    f = db.query(Formula).filter_by(id=formula_id, template_version_id=tv.id).first()
    if not f: raise HTTPException(404)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(f, k, v)
    db.commit(); db.refresh(f)
    return f

@router.delete("/{template_id}/formulas/{formula_id}")
def delete_formula(template_id: int, formula_id: int, db: Session = Depends(get_db),
                   current_user=Depends(require_role("pif_admin"))):
    tv = _get_draft_version(template_id, db)
    f = db.query(Formula).filter_by(id=formula_id, template_version_id=tv.id).first()
    if not f: raise HTTPException(404)
    db.delete(f); db.commit()
    return {"deleted": True}
```

- [ ] Register routers in `backend/app/main.py`:
```python
from app.api.routes.templates import router as templates_router
from app.api.routes.formulas import router as formulas_router
app.include_router(templates_router)
app.include_router(formulas_router)
```

- [ ] Write basic route tests:

```python
# backend/tests/test_template_routes.py
def test_create_template(client_pif):
    resp = client_pif.post("/api/templates", json={"name": "HSE Template"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "HSE Template"

def test_devco_cannot_create_template(client_devco):
    resp = client_devco.post("/api/templates", json={"name": "HSE Template"})
    assert resp.status_code == 403
```

- [ ] Run: `cd backend && pytest tests/test_template_routes.py -v`

- [ ] Commit:
```bash
git add backend/app/api/routes/templates.py backend/app/api/routes/formulas.py backend/app/main.py backend/tests/test_template_routes.py
git commit -m "add template and formula routes"
```

---

### Task 12: Frontend templates store + views

**Files:**
- Create: `frontend/src/stores/templates.ts`
- Create: `frontend/src/views/admin/TemplateListView.vue`
- Create: `frontend/src/views/admin/TemplateBuilderView.vue`
- Create: `frontend/src/views/admin/TemplateDetailView.vue`
- Create: `frontend/src/components/templates/ImportTemplateModal.vue`
- Create: `frontend/src/components/templates/AssignmentModal.vue`
- Create: `frontend/src/views/TemplateListView.vue` (DevCo)

- [ ] Create `frontend/src/stores/templates.ts`:

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useApi } from '@/composables/useApi'

export interface TemplateColumn {
  name: string
  type: 'text' | 'number' | 'date' | 'percentage'
  required: boolean
  identifier: boolean
  validation?: { min?: number; max?: number } | null
}

export interface Formula {
  id: number
  name: string
  expression: string
  scoring_rules: any[] | null
  scope: string
  display_order: number
}

export interface TemplateVersion {
  id: number
  version_number: number
  schema_json: { submission_mode: string; columns: TemplateColumn[] }
  published_at: string | null
  formulas: Formula[]
}

export interface Template {
  id: number
  name: string
  description: string | null
  status: 'draft' | 'active' | 'deprecated'
  created_at: string
  updated_at: string
  current_version: TemplateVersion | null
}

export const useTemplatesStore = defineStore('templates', () => {
  const { apiCall } = useApi()
  const templates = ref<Template[]>([])
  const current = ref<Template | null>(null)
  const loading = ref(false)

  async function fetchAll() {
    loading.value = true
    const data = await apiCall<{ templates: Template[] }>('/api/templates')
    templates.value = data.templates
    loading.value = false
  }

  async function fetchOne(id: number) {
    current.value = await apiCall<Template>(`/api/templates/${id}`)
  }

  async function create(name: string, description?: string) {
    const t = await apiCall<Template>('/api/templates', { method: 'POST', body: { name, description } })
    templates.value.push(t)
    return t
  }

  async function publishVersion(templateId: number, schemaJson: object) {
    return apiCall(`/api/templates/${templateId}/versions`, { method: 'POST', body: { schema_json: schemaJson } })
  }

  async function addFormula(templateId: number, formula: Omit<Formula, 'id'>) {
    return apiCall(`/api/templates/${templateId}/formulas`, { method: 'POST', body: formula })
  }

  async function updateFormula(templateId: number, formulaId: number, updates: Partial<Formula>) {
    return apiCall(`/api/templates/${templateId}/formulas/${formulaId}`, { method: 'PUT', body: updates })
  }

  async function deleteFormula(templateId: number, formulaId: number) {
    return apiCall(`/api/templates/${templateId}/formulas/${formulaId}`, { method: 'DELETE' })
  }

  async function assign(templateId: number, orgIds: number[] | null) {
    return apiCall(`/api/templates/${templateId}/assign`, { method: 'POST', body: { org_ids: orgIds } })
  }

  async function updateStatus(templateId: number, status: Template['status']) {
    return apiCall(`/api/templates/${templateId}/status`, { method: 'PUT', body: { status } })
  }

  const assignedTemplates = computed(() => templates.value.filter(t => t.status === 'active'))

  return { templates, current, loading, fetchAll, fetchOne, create, publishVersion,
           addFormula, updateFormula, deleteFormula, assign, updateStatus, assignedTemplates }
})
```

- [ ] Create `TemplateListView.vue` (PIF admin) with:
  - Table: Name, Status badge (draft=gray/active=green/deprecated=muted), Version #, Updated
  - "New Template" button → `/admin/templates/new`
  - "Import Template" button → opens `ImportTemplateModal`
  - Click row → `/admin/templates/:id`

- [ ] Create `ImportTemplateModal.vue` with 2-step flow:
  - Step 1: File picker (accept=".xlsx"), POST to `/api/templates/import/parse`, sheet selector if multiple sheets
  - Step 2: Editable column table (type dropdown, required checkbox, identifier checkbox) + 3 sample rows below; "Create Draft" POSTs to `/api/templates/import/confirm`

- [ ] Create `TemplateBuilderView.vue` with:
  - Two tabs: Columns | Formulas
  - Columns tab: uses existing `SpreadsheetEditor` on left, config panel on right
  - Formulas tab: list of formula rows (name, expression, scope) + inline edit panel with scoring rules table
  - "Save Draft" and "Publish" buttons (clear visual distinction)

- [ ] Create `TemplateDetailView.vue` with:
  - Current version schema display
  - Version history timeline
  - Assignments tab with "Add Assignment" → `AssignmentModal`

- [ ] Create `AssignmentModal.vue`: searchable org list with checkboxes, "Assign to All" toggle

- [ ] Create `TemplateListView.vue` (DevCo — `/templates`): list of assigned templates with submission status badges per period (Not Started / Draft / Submitted / Reviewed); primary action "Start Submission" or "Continue Draft"

- [ ] Commit:
```bash
git add frontend/src/stores/templates.ts frontend/src/views/ frontend/src/components/templates/
git commit -m "add template engine frontend (store, views, modals)"
```

---

## Chunk 3: Submission & Consolidation Pipeline

### Task 13: Submission + CalculatedResult + ConsolidatedSheet models

**Files:**
- Create: `backend/app/models/submission.py`
- Create: `backend/app/models/calculated_result.py`
- Create: `backend/app/models/consolidated_sheet.py`

- [ ] Create `backend/app/models/submission.py`:

```python
import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Enum, JSON, DateTime, ForeignKey, LargeBinary
from app.db.session import Base

class SubmissionStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    reviewed = "reviewed"

class Submission(Base):
    __tablename__ = "submissions"
    id = Column(Integer, primary_key=True, index=True)
    template_version_id = Column(Integer, ForeignKey("template_versions.id"), nullable=False)
    submitter_org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    submitter_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    period = Column(String(10), nullable=False)  # e.g. "2026-03"
    status = Column(Enum(SubmissionStatus), default=SubmissionStatus.draft, nullable=False)
    data_json = Column(JSON, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    locked_at = Column(DateTime, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
```

- [ ] Create `backend/app/models/calculated_result.py`:

```python
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text
from app.db.session import Base

class CalculatedResult(Base):
    __tablename__ = "calculated_results"
    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    formula_id = Column(Integer, ForeignKey("formulas.id"), nullable=False)
    expression = Column(Text, nullable=False)
    rate_value = Column(String(50), nullable=True)   # stored as string to handle errors
    score = Column(Integer, nullable=True)
    error = Column(String(50), nullable=True)         # e.g. "DIV_ZERO", "MISSING_COLUMN"
    calculated_at = Column(DateTime, default=datetime.utcnow)
```

- [ ] Create `backend/app/models/consolidated_sheet.py`:

```python
from datetime import datetime
from sqlalchemy import Column, Integer, String, LargeBinary, DateTime, ForeignKey
from app.db.session import Base

class ConsolidatedSheet(Base):
    __tablename__ = "consolidated_sheets"
    id = Column(Integer, primary_key=True, index=True)
    template_version_id = Column(Integer, ForeignKey("template_versions.id"), nullable=False)
    period = Column(String(10), nullable=False)
    master_data = Column(LargeBinary, nullable=False)
    generated_at = Column(DateTime, default=datetime.utcnow)
    generated_by = Column(Integer, ForeignKey("users.id"), nullable=False)
```

- [ ] Commit:
```bash
git add backend/app/models/submission.py backend/app/models/calculated_result.py backend/app/models/consolidated_sheet.py
git commit -m "add submission, calculated_result, consolidated_sheet models"
```

---

### Task 14: Formula engine service

**Files:**
- Create: `backend/app/services/formula_engine.py`

- [ ] Write failing tests:

```python
# backend/tests/test_formula_engine.py
from app.services.formula_engine import execute_formula

ROWS = [
    {"Level_1": "NEOM", "Total_No_of_Manhours": 2500000, "Total_Recordable_Incident": 1,
     "No_of_Fatality": 0},
    {"Level_1": "NEOM", "Total_No_of_Manhours": 1800000, "Total_Recordable_Incident": 2,
     "No_of_Fatality": 0},
]

def test_trir():
    # TRIR = SUM({TRI}) / SUM({Manhours}) * 200000
    result = execute_formula(
        "SUM({Total_Recordable_Incident}) / SUM({Total_No_of_Manhours}) * 200000",
        ROWS, scoring_rules=None
    )
    # (1+2) / (2500000+1800000) * 200000 = 3/4300000*200000 ≈ 0.1395...
    assert result["error"] is None
    assert abs(float(result["rate_value"]) - 3/4300000*200000) < 0.001

def test_scoring_rules():
    rules = [{"condition": "==", "value": 0, "score": 100},
             {"condition": "<=", "value": 0.045, "score": 90},
             {"condition": ">", "value": 0.045, "score": 0}]
    result = execute_formula(
        "SUM({No_of_Fatality}) / SUM({Total_No_of_Manhours}) * 200000",
        ROWS, scoring_rules=rules
    )
    assert result["score"] == 100  # rate is 0

def test_div_zero():
    result = execute_formula("SUM({Total_Recordable_Incident}) / SUM({No_of_Fatality})",
                             ROWS, scoring_rules=None)
    assert result["error"] == "DIV_ZERO"
    assert result["rate_value"] is None

def test_missing_column():
    result = execute_formula("SUM({NonExistentColumn}) / 1000", ROWS, scoring_rules=None)
    assert result["error"] == "MISSING_COLUMN"
```

- [ ] Run: `cd backend && pytest tests/test_formula_engine.py -v` — expect FAIL

- [ ] Create `backend/app/services/formula_engine.py`:

```python
import ast, re
from typing import Any

AGG_PATTERN = re.compile(r"(SUM|AVG|MIN|MAX|COUNT)\(\{(\w+)\}\)", re.IGNORECASE)
BARE_PATTERN = re.compile(r"\{(\w+)\}")

def _safe_eval(expr: str) -> float:
    """Evaluate a numeric-only expression using ast (no eval)."""
    tree = ast.parse(expr, mode="eval")
    for node in ast.walk(tree):
        if not isinstance(node, (ast.Expression, ast.Constant, ast.BinOp,
                                  ast.UnaryOp, ast.Add, ast.Sub, ast.Mult,
                                  ast.Div, ast.Pow, ast.USub, ast.UAdd)):
            raise ValueError(f"Disallowed AST node: {type(node).__name__}")
    return eval(compile(tree, "<expr>", "eval"))  # noqa: S307

def _apply_scoring(rate: float, rules: list) -> int | None:
    for rule in rules:
        cond, val, score = rule["condition"], rule["value"], rule["score"]
        if cond == "==" and rate == val: return score
        if cond == "<=" and rate <= val: return score
        if cond == "<"  and rate < val:  return score
        if cond == ">=" and rate >= val: return score
        if cond == ">"  and rate > val:  return score
    return None

def execute_formula(expression: str, rows: list[dict], scoring_rules: list | None) -> dict:
    result = {"expression": expression, "rate_value": None, "score": None, "error": None}
    expr = expression

    # Pass 1: aggregate resolution
    def resolve_agg(m):
        fn, col = m.group(1).upper(), m.group(2)
        vals = []
        for row in rows:
            if col not in row:
                return "__MISSING__"
            v = row[col]
            if v is not None:
                try: vals.append(float(v))
                except (TypeError, ValueError): pass
        if not vals: return "0"
        if fn == "SUM": return str(sum(vals))
        if fn == "AVG": return str(sum(vals) / len(vals))
        if fn == "MIN": return str(min(vals))
        if fn == "MAX": return str(max(vals))
        if fn == "COUNT": return str(len(vals))
        return "0"

    expr = AGG_PATTERN.sub(resolve_agg, expr)
    if "__MISSING__" in expr:
        result["error"] = "MISSING_COLUMN"
        return result

    # Pass 2: bare column references (only valid for single-row)
    bare_refs = BARE_PATTERN.findall(expr)
    if bare_refs:
        if len(rows) > 1:
            result["error"] = "AMBIGUOUS_BARE_REF"
            return result
        row = rows[0]
        for col in bare_refs:
            if col not in row:
                result["error"] = "MISSING_COLUMN"
                return result
            expr = expr.replace(f"{{{col}}}", str(row[col]))

    # Pass 3: safe arithmetic
    try:
        rate = _safe_eval(expr)
    except ZeroDivisionError:
        result["error"] = "DIV_ZERO"
        return result
    except Exception as e:
        result["error"] = f"EVAL_ERROR: {e}"
        return result

    result["rate_value"] = str(rate)

    # Pass 4: scoring
    if scoring_rules:
        result["score"] = _apply_scoring(rate, scoring_rules)

    return result

def execute_all_formulas(data_json: dict, formulas: list) -> list[dict]:
    rows = data_json.get("rows", [])
    results = []
    for f in formulas:
        r = execute_formula(f.expression, rows, f.scoring_rules)
        r["formula_id"] = f.id
        results.append(r)
    return results
```

- [ ] Run: `cd backend && pytest tests/test_formula_engine.py -v` — expect PASS

- [ ] Commit:
```bash
git add backend/app/services/formula_engine.py backend/tests/test_formula_engine.py
git commit -m "add formula engine with aggregate resolution and safe eval"
```

---

### Task 15: Submission routes

**Files:**
- Create: `backend/app/api/routes/submissions.py`
- Create: `backend/app/schemas/submissions.py`

- [ ] Create `backend/app/schemas/submissions.py`:

```python
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime

class SubmissionCreate(BaseModel):
    template_version_id: int
    period: str  # "2026-03"

class SubmissionUpdate(BaseModel):
    data_json: dict  # {"rows": [...]}

class CalculatedResultResponse(BaseModel):
    formula_id: int
    expression: str
    rate_value: Optional[str]
    score: Optional[int]
    error: Optional[str]
    model_config = {"from_attributes": True}

class SubmissionResponse(BaseModel):
    id: int
    template_version_id: int
    submitter_org_id: int
    period: str
    status: str
    data_json: Optional[dict]
    submitted_at: Optional[datetime]
    reviewed_at: Optional[datetime]
    calculated_results: List[CalculatedResultResponse] = []
    model_config = {"from_attributes": True}
```

- [ ] Create `backend/app/api/routes/submissions.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
from app.db.session import get_db
from app.core.dependencies import require_role, get_current_user
from app.models.submission import Submission, SubmissionStatus
from app.models.calculated_result import CalculatedResult
from app.models.template_version import TemplateVersion
from app.models.formula import Formula
from app.schemas.submissions import SubmissionCreate, SubmissionUpdate, SubmissionResponse
from app.services.formula_engine import execute_all_formulas
from typing import List

router = APIRouter(prefix="/api/submissions", tags=["submissions"])

@router.post("", response_model=SubmissionResponse)
def create_submission(body: SubmissionCreate, db: Session = Depends(get_db),
                      current_user=Depends(get_current_user)):
    s = Submission(template_version_id=body.template_version_id, period=body.period,
                   submitter_org_id=current_user.org_id, submitter_user_id=current_user.id,
                   data_json={"rows": []})
    db.add(s); db.commit(); db.refresh(s)
    return _submission_response(s, db)

@router.put("/{submission_id}", response_model=SubmissionResponse)
def update_submission(submission_id: int, body: SubmissionUpdate, db: Session = Depends(get_db),
                      current_user=Depends(get_current_user)):
    s = db.query(Submission).filter_by(id=submission_id).first()
    if not s: raise HTTPException(404)
    if s.submitter_org_id != current_user.org_id: raise HTTPException(403)
    if s.status != SubmissionStatus.draft: raise HTTPException(400, "Submission is locked")
    s.data_json = body.data_json
    db.commit(); db.refresh(s)
    return _submission_response(s, db)

@router.post("/{submission_id}/submit", response_model=SubmissionResponse)
def submit(submission_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    s = db.query(Submission).filter_by(id=submission_id).first()
    if not s: raise HTTPException(404)
    if s.submitter_org_id != current_user.org_id: raise HTTPException(403)
    if s.status != SubmissionStatus.draft: raise HTTPException(400, "Already submitted")
    # Validate required fields
    tv = db.query(TemplateVersion).filter_by(id=s.template_version_id).first()
    schema = tv.schema_json
    required_cols = [c["name"] for c in schema.get("columns", []) if c.get("required")]
    rows = (s.data_json or {}).get("rows", [])
    for row in rows:
        for col in required_cols:
            if col not in row or row[col] is None or row[col] == "":
                raise HTTPException(400, f"Required field '{col}' missing in a row")
    # Lock submission
    now = datetime.utcnow()
    s.status = SubmissionStatus.submitted
    s.submitted_at = now
    s.locked_at = now
    db.commit()
    # Run formula engine
    formulas = db.query(Formula).filter_by(template_version_id=tv.id).all()
    results = execute_all_formulas(s.data_json, formulas)
    for r in results:
        cr = CalculatedResult(submission_id=s.id, formula_id=r["formula_id"],
                              expression=r["expression"], rate_value=r.get("rate_value"),
                              score=r.get("score"), error=r.get("error"))
        db.add(cr)
    db.commit(); db.refresh(s)
    return _submission_response(s, db)

@router.get("", response_model=List[SubmissionResponse])
def list_submissions(org_id: Optional[int] = None, period: Optional[str] = None,
                     db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    q = db.query(Submission)
    if current_user.role == "pif_admin":
        if org_id: q = q.filter_by(submitter_org_id=org_id)
    else:
        q = q.filter_by(submitter_org_id=current_user.org_id)
    if period: q = q.filter_by(period=period)
    return [_submission_response(s, db) for s in q.all()]

@router.get("/{submission_id}", response_model=SubmissionResponse)
def get_submission(submission_id: int, db: Session = Depends(get_db),
                   current_user=Depends(get_current_user)):
    s = db.query(Submission).filter_by(id=submission_id).first()
    if not s: raise HTTPException(404)
    if current_user.role != "pif_admin" and s.submitter_org_id != current_user.org_id:
        raise HTTPException(403)
    return _submission_response(s, db)

@router.put("/{submission_id}/review", response_model=SubmissionResponse)
def review(submission_id: int, db: Session = Depends(get_db),
           current_user=Depends(require_role("pif_admin"))):
    s = db.query(Submission).filter_by(id=submission_id).first()
    if not s: raise HTTPException(404)
    s.status = SubmissionStatus.reviewed
    s.reviewed_at = datetime.utcnow()
    s.reviewed_by = current_user.id
    db.commit(); db.refresh(s)
    return _submission_response(s, db)

def _submission_response(s: Submission, db: Session) -> dict:
    results = db.query(CalculatedResult).filter_by(submission_id=s.id).all()
    return {**{c.name: getattr(s, c.name) for c in s.__table__.columns},
            "calculated_results": [{"formula_id": r.formula_id, "expression": r.expression,
                                     "rate_value": r.rate_value, "score": r.score, "error": r.error}
                                    for r in results]}
```

- [ ] Write test:

```python
# backend/tests/test_submission_routes.py
def test_submit_locks_data(client_devco, seeded_template_version):
    # Create draft
    resp = client_devco.post("/api/submissions", json={"template_version_id": seeded_template_version, "period": "2026-03"})
    sid = resp.json()["id"]
    # Save data
    client_devco.put(f"/api/submissions/{sid}", json={"data_json": {"rows": [{"Level_1": "NEOM", "Total_No_of_Manhours": 1000}]}})
    # Submit
    resp = client_devco.post(f"/api/submissions/{sid}/submit")
    assert resp.json()["status"] == "submitted"
    # Try to edit locked submission
    resp = client_devco.put(f"/api/submissions/{sid}", json={"data_json": {"rows": []}})
    assert resp.status_code == 400
```

- [ ] Register router in `main.py`: `from app.api.routes.submissions import router as submissions_router; app.include_router(submissions_router)`

- [ ] Run: `cd backend && pytest tests/test_submission_routes.py -v`

- [ ] Commit:
```bash
git add backend/app/api/routes/submissions.py backend/app/schemas/submissions.py backend/app/main.py backend/tests/test_submission_routes.py
git commit -m "add submission routes with lock-on-submit and formula execution"
```

---

### Task 16: Consolidation service + routes

**Files:**
- Create: `backend/app/services/consolidation.py`
- Create: `backend/app/api/routes/consolidations.py`

- [ ] Write failing tests:

```python
# backend/tests/test_consolidation.py
from app.services.consolidation import build_master_sheet
import openpyxl, io

def _parse_xlsx(data: bytes):
    return openpyxl.load_workbook(io.BytesIO(data)).active

def test_build_master_sheet_returns_bytes():
    formulas = [{"id": 1, "name": "TRIR", "display_order": 0}]
    all_org_names = ["NEOM", "ROSHN", "ACWA"]  # all DevCos for the period
    submissions = [
        {"org_name": "NEOM", "period": "2026-03", "status": "submitted",
         "calculated_results": [{"formula_id": 1, "rate_value": "0.14", "score": 80, "error": None}]},
        {"org_name": "ROSHN", "period": "2026-03", "status": "submitted",
         "calculated_results": [{"formula_id": 1, "rate_value": "0.05", "score": 90, "error": None}]},
    ]
    result = build_master_sheet(submissions, formulas, period="2026-03", all_org_names=all_org_names)
    assert isinstance(result, bytes)
    ws = _parse_xlsx(result)
    row_orgs = [ws.cell(row=r, column=1).value for r in range(2, ws.max_row + 1)]
    assert "ACWA" in row_orgs          # non-submitted org included
    assert "TOTALS" in row_orgs        # totals row present

def test_not_submitted_org_shows_marker():
    formulas = [{"id": 1, "name": "TRIR", "display_order": 0}]
    result = build_master_sheet([], formulas, period="2026-03", all_org_names=["UNSUB"])
    ws = _parse_xlsx(result)
    status_cell = ws.cell(row=2, column=3).value
    assert status_cell == "Not Submitted"
```

- [ ] Run: `cd backend && pytest tests/test_consolidation.py -v` — expect FAIL

- [ ] Create `backend/app/services/consolidation.py`:

```python
import io
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment

def build_master_sheet(submissions: list, formulas: list, period: str,
                       all_org_names: list[str] | None = None) -> bytes:
    """Build master KPI .xlsx. One row per DevCo (including non-submitted). Totals row at bottom."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"Master KPI {period}"

    header_fill = PatternFill("solid", fgColor="1F3864")
    header_font = Font(bold=True, color="FFFFFF")
    totals_font = Font(bold=True)

    sorted_formulas = sorted(formulas, key=lambda x: x.get("display_order", 0))
    formula_ids = [f["id"] for f in sorted_formulas]

    headers = ["Organisation", "Period", "Status"]
    for f in sorted_formulas:
        headers.append(f"{f['name']} Rate")
        headers.append(f"{f['name']} Score (%)")

    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")

    # Index submitted orgs
    submitted_by_org = {s["org_name"]: s for s in submissions}

    # All orgs = submitted + any extras passed in that didn't submit
    org_names = list(submitted_by_org.keys())
    if all_org_names:
        for name in all_org_names:
            if name not in submitted_by_org:
                org_names.append(name)

    totals: dict[int, list[float]] = {fid: [] for fid in formula_ids}

    for row_idx, org_name in enumerate(org_names, 2):
        sub = submitted_by_org.get(org_name)
        ws.cell(row=row_idx, column=1, value=org_name)
        ws.cell(row=row_idx, column=2, value=period)
        ws.cell(row=row_idx, column=3, value=sub["status"].title() if sub else "Not Submitted")
        col = 4
        results_by_fid = {r["formula_id"]: r for r in (sub or {}).get("calculated_results", [])}
        for fid in formula_ids:
            r = results_by_fid.get(fid)
            if r and not r.get("error") and r.get("rate_value") is not None:
                rate = float(r["rate_value"])
                ws.cell(row=row_idx, column=col, value=rate)
                ws.cell(row=row_idx, column=col+1, value=r.get("score"))
                totals[fid].append(rate)
            else:
                ws.cell(row=row_idx, column=col, value=r.get("error") if r else None)
                ws.cell(row=row_idx, column=col+1, value=None)
            col += 2

    # Totals row
    totals_row = len(org_names) + 2
    ws.cell(row=totals_row, column=1, value="TOTALS").font = totals_font
    ws.cell(row=totals_row, column=2, value=period)
    ws.cell(row=totals_row, column=3, value=f"{len(submitted_by_org)}/{len(org_names)} submitted")
    col = 4
    for fid in formula_ids:
        vals = totals[fid]
        ws.cell(row=totals_row, column=col, value=sum(vals)/len(vals) if vals else None)
        ws.cell(row=totals_row, column=col+1, value=None)
        col += 2

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()
```

- [ ] Run: `cd backend && pytest tests/test_consolidation.py -v` — expect PASS

- [ ] Create `backend/app/api/routes/consolidations.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.dependencies import require_role
from app.models.submission import Submission, SubmissionStatus
from app.models.template_version import TemplateVersion
from app.models.formula import Formula
from app.models.consolidated_sheet import ConsolidatedSheet
from app.models.organization import Organization
from app.models.calculated_result import CalculatedResult
from app.services.consolidation import build_master_sheet
from typing import List

router = APIRouter(prefix="/api/consolidations", tags=["consolidations"])

@router.post("")
def trigger_consolidation(template_id: int, period: str, db: Session = Depends(get_db),
                          current_user=Depends(require_role("pif_admin"))):
    # Get latest version of template
    tv = (db.query(TemplateVersion).filter_by(template_id=template_id)
          .order_by(TemplateVersion.version_number.desc()).first())
    if not tv: raise HTTPException(404, "Template has no versions")

    # Get all submitted/reviewed submissions for this period + version
    submissions = (db.query(Submission)
        .filter_by(template_version_id=tv.id, period=period)
        .filter(Submission.status.in_([SubmissionStatus.submitted, SubmissionStatus.reviewed]))
        .all())

    formulas = db.query(Formula).filter_by(template_version_id=tv.id).order_by(Formula.display_order).all()
    formula_dicts = [{"id": f.id, "name": f.name, "display_order": f.display_order} for f in formulas]

    sub_dicts = []
    for s in submissions:
        org = db.query(Organization).filter_by(id=s.submitter_org_id).first()
        results = db.query(CalculatedResult).filter_by(submission_id=s.id).all()
        sub_dicts.append({
            "org_name": org.name if org else str(s.submitter_org_id),
            "period": s.period,
            "status": s.status.value,
            "calculated_results": [{"formula_id": r.formula_id, "rate_value": r.rate_value,
                                     "score": r.score, "error": r.error} for r in results]
        })

    # All assigned DevCo orgs for this template version (for not-submitted rows)
    assignments = db.query(TemplateAssignment).filter_by(template_version_id=tv.id).all()
    if any(a.assignee_org_id is None for a in assignments):
        # assigned to all devcos
        all_orgs = db.query(Organization).filter_by(type="devco").all()
    else:
        org_ids = [a.assignee_org_id for a in assignments]
        all_orgs = db.query(Organization).filter(Organization.id.in_(org_ids)).all()
    all_org_names = [o.name for o in all_orgs]

    master_bytes = build_master_sheet(sub_dicts, formula_dicts, period=period,
                                      all_org_names=all_org_names)

    cs = ConsolidatedSheet(template_version_id=tv.id, period=period,
                           master_data=master_bytes, generated_by=current_user.id)
    db.add(cs); db.commit(); db.refresh(cs)
    return {"id": cs.id, "period": cs.period, "generated_at": cs.generated_at,
            "devco_count": len(all_org_names), "submitted_count": len(sub_dicts)}

@router.get("")
def list_consolidations(db: Session = Depends(get_db),
                        current_user=Depends(require_role("pif_admin"))):
    sheets = db.query(ConsolidatedSheet).order_by(ConsolidatedSheet.generated_at.desc()).all()
    return [{"id": s.id, "period": s.period, "template_version_id": s.template_version_id,
             "generated_at": s.generated_at} for s in sheets]

@router.get("/{sheet_id}/download")
def download(sheet_id: int, db: Session = Depends(get_db),
             current_user=Depends(require_role("pif_admin"))):
    cs = db.query(ConsolidatedSheet).filter_by(id=sheet_id).first()
    if not cs: raise HTTPException(404)
    return Response(content=cs.master_data,
                    media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f"attachment; filename=master_{cs.period}.xlsx"})
```

- [ ] Register router in `main.py`

- [ ] Run tests

- [ ] Commit:
```bash
git add backend/app/services/consolidation.py backend/app/api/routes/consolidations.py backend/app/main.py backend/tests/test_consolidation.py
git commit -m "add consolidation service and routes with xlsx generation"
```

---

### Task 17: Frontend submission store + views

**Files:**
- Create: `frontend/src/stores/submissions.ts`
- Create: `frontend/src/views/SubmissionFormView.vue`
- Create: `frontend/src/views/SubmissionListView.vue`
- Create: `frontend/src/views/admin/ConsolidationDashboardView.vue`

- [ ] Create `frontend/src/stores/submissions.ts`:

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useApi } from '@/composables/useApi'

export interface SubmissionRow { [key: string]: any }
export interface Submission {
  id: number
  template_version_id: number
  period: string
  status: 'draft' | 'submitted' | 'reviewed'
  data_json: { rows: SubmissionRow[] } | null
  submitted_at: string | null
  calculated_results: any[]
}

export const useSubmissionsStore = defineStore('submissions', () => {
  const { apiCall } = useApi()
  const submissions = ref<Submission[]>([])
  const current = ref<Submission | null>(null)
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

  async function fetchAll() {
    submissions.value = await apiCall<Submission[]>('/api/submissions')
  }

  async function fetchOne(id: number) {
    current.value = await apiCall<Submission>(`/api/submissions/${id}`)
  }

  async function create(templateVersionId: number, period: string) {
    const s = await apiCall<Submission>('/api/submissions', {
      method: 'POST', body: { template_version_id: templateVersionId, period }
    })
    current.value = s
    return s
  }

  function scheduleAutoSave(submissionId: number, dataJson: object) {
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
    autoSaveTimer = setTimeout(() => save(submissionId, dataJson), 2000)
  }

  async function save(submissionId: number, dataJson: object) {
    await apiCall(`/api/submissions/${submissionId}`, { method: 'PUT', body: { data_json: dataJson } })
  }

  async function submit(submissionId: number) {
    const s = await apiCall<Submission>(`/api/submissions/${submissionId}/submit`, { method: 'POST' })
    current.value = s
    return s
  }

  return { submissions, current, fetchAll, fetchOne, create, scheduleAutoSave, save, submit }
})
```

- [ ] Create `SubmissionFormView.vue`:
  - Loads template schema from `templates` store → renders columns in SpreadsheetEditor
  - Required columns visually marked (red header)
  - Number columns enforce `min: 0` validation
  - Period display at top, template name
  - Auto-save every 2s when data changes
  - "Submit" button → confirmation modal: "Submit [Template Name] for [Period]? This cannot be undone."
  - On confirm: calls `submissions.submit()` → transitions view to read-only with submitted timestamp badge
  - Read-only mode when `submission.status !== 'draft'`

- [ ] Create `SubmissionListView.vue`:
  - Table: Period, Template Name, Status badge, Submitted At, Reviewed At
  - Click row → `/submissions/:id` (read-only if submitted, shows calculated results below spreadsheet)

- [ ] Create `ConsolidationDashboardView.vue`:
  - Status matrix: rows = DevCo orgs, cols = last 6 months, cells = color-coded status
  - "Generate Master Sheet" control: template selector + period picker + trigger button
  - Loading state → download button on complete
  - Past consolidation runs list with download links

- [ ] Commit:
```bash
git add frontend/src/stores/submissions.ts frontend/src/views/SubmissionFormView.vue frontend/src/views/SubmissionListView.vue frontend/src/views/admin/ConsolidationDashboardView.vue
git commit -m "add submission store, form view, list view, consolidation dashboard"
```

---

### Task 18: Add org_id to Record model, then scope routes by org

**Files:**
- Modify: `backend/app/models/record.py`
- Modify: `backend/app/api/routes/records.py`
- Modify: `backend/app/api/routes/files.py`

- [ ] Write failing test:

```python
# backend/tests/test_org_scoping.py
def test_devco_a_cannot_see_devco_b_records(client_devco_a, client_devco_b, seeded_record_org_a):
    resp = client_devco_b.get("/api/records")
    assert resp.status_code == 200
    ids = [r["id"] for r in resp.json()["records"]]
    assert seeded_record_org_a not in ids
```

- [ ] Run test — expect FAIL

- [ ] Add `org_id` column to `backend/app/models/record.py`:

```python
org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
# nullable=True for backwards-compat with existing rows; new records always set it
```

- [ ] In `records.py`, update queries:

```python
# Before:
db.query(Record).filter_by(user_id=current_user.id)
# After:
db.query(Record).filter_by(org_id=current_user.org_id)
```

Also set `org_id=current_user.org_id` when creating a new Record.

- [ ] In `files.py`, update `UploadedFile` queries to scope by org. If `UploadedFile` has no `org_id`, add it the same way.

- [ ] Run test — expect PASS

- [ ] Commit:
```bash
git add backend/app/models/record.py backend/app/api/routes/records.py backend/app/api/routes/files.py backend/tests/test_org_scoping.py
git commit -m "add org_id to Record/UploadedFile, scope routes by org"
```

---

### Task 19: Wire everything + smoke test

- [ ] Start the full stack: `docker compose up` (or `uvicorn` + `npm run dev`)

- [ ] Hit `GET /api/auth/dev-login/pif_admin` → verify cookie is set, role is `pif_admin`

- [ ] Create an org via `POST /api/admin/organizations` — verify 200

- [ ] Create a template via `POST /api/templates` — verify 200

- [ ] Upload an .xlsx via `POST /api/templates/import/parse` with the NEOM HSE file — verify `TemplateImportPreview` columns match expected

- [ ] Publish a version + add TRIR formula — verify formulas route returns them

- [ ] Switch to devco_user dev login — verify can see assigned templates, cannot hit `/api/admin/*`

- [ ] Create a submission, save data with 2 rows, submit — verify `calculated_results` contains TRIR with rate_value and score

- [ ] Trigger consolidation as pif_admin — verify download returns valid .xlsx

- [ ] Commit any fixes as atomic commits

---

## Unresolved Questions

1. **Keycloak URL**: Dev Keycloak server URL needed to replace dev-login with real OAuth2 flow. Until confirmed, dev-login endpoints stay.
2. **Realm vs claims**: Are orgs encoded as Keycloak realms or custom JWT claims? Determines whether `org_id` is stored in our DB or inherited from token. (~60% of auth architecture)
3. **Role mapping**: What role names exist in their Keycloak today? Need to confirm mapping to `pif_admin / devco_admin / devco_user`.
4. **PKCE flow**: Does the frontend need PKCE (user-facing) or client credentials (backend-to-backend)?
5. **General Use Case roles**: For the general (non-PIF) use case, "Head PM" maps to `pif_admin` and "Subcontractor" maps to `devco_user`. Should the UI use different role labels for non-PIF orgs, or are the same views shared?
