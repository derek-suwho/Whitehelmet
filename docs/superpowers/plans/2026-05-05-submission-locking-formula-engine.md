# Submission Locking + Formula Engine Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PIF admin submission locking and Excel-formula-based auto-processing of DevCo submissions on upload.

**Architecture:** Two independent features. Locking adds two columns to `template_assignments` and two admin endpoints. The formula engine adds a `TemplateFormula` model, a `FormulaExecutor` service that writes Excel formulas into submitted xlsx files and evaluates them with `xlcalculator`, and wires the executor into the existing submit endpoint.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, openpyxl, xlcalculator, pytest, SQLite (tests)

---

## File Map

| File | Action |
|------|--------|
| `backend/app/models/template_assignment.py` | Add `locked_at`, `locked_by` columns |
| `backend/app/models/submission.py` | Add `processed_file_path` column |
| `backend/app/models/template_formula.py` | New — TemplateFormula ORM model |
| `backend/app/models/__init__.py` | Export TemplateFormula |
| `backend/app/schemas/template_formula.py` | New — Pydantic schemas for formula CRUD |
| `backend/app/services/formula_executor.py` | New — FormulaExecutor service |
| `backend/app/api/routes/admin.py` | Add lock/unlock + formula CRUD endpoints |
| `backend/app/api/routes/subcontractor.py` | Wire FormulaExecutor into submit endpoint |
| `backend/migrations/versions/XXXX_locking_and_formula_engine.py` | New Alembic migration |
| `backend/requirements.txt` | Add `xlcalculator` |
| `backend/tests/unit/test_formula_executor.py` | New — unit tests for FormulaExecutor |
| `backend/tests/unit/test_submission_models.py` | Extend — test new model columns |
| `backend/tests/integration/test_locking.py` | New — lock/unlock endpoint tests |
| `backend/tests/integration/test_formula_crud.py` | New — formula CRUD endpoint tests |

---

## Chunk 1: Submission Locking

### Task 1: Add locked_at / locked_by to TemplateAssignment + migration

**Files:**
- Modify: `backend/app/models/template_assignment.py`
- Modify: `backend/app/models/submission.py`
- Modify: `backend/app/models/template_formula.py` (create)
- Create: `backend/migrations/versions/XXXX_locking_and_formula_engine.py`

- [ ] **Step 1: Update TemplateAssignment model**

In `backend/app/models/template_assignment.py`, add after the `assigned_to_user_id` line:

```python
locked_at = Column(DateTime, nullable=True)
locked_by = Column(String(36), nullable=True)
```

Full file after edit:
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
    submission_type = Column(String(10), nullable=False, default="template")
    instructions = Column(Text, nullable=True)
    status = Column(String(10), nullable=False, default="pending")  # pending | submitted | locked
    upload_token = Column(String(255), nullable=True, unique=True)
    upload_token_expires_at = Column(DateTime, nullable=True)
    assigned_at = Column(DateTime, server_default=func.now(), nullable=False)
    assigned_to_user_id = Column(String(36), nullable=True, index=True)
    locked_at = Column(DateTime, nullable=True)
    locked_by = Column(String(36), nullable=True)
```

- [ ] **Step 2: Update Submission model**

In `backend/app/models/submission.py`, add `processed_file_path` column:

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
    processed_file_path = Column(String(500), nullable=True)
```

- [ ] **Step 3: Create TemplateFormula model**

Create `backend/app/models/template_formula.py`:

```python
"""TemplateFormula — Excel-style formula attached to a template version, applied on submission."""

import uuid
from sqlalchemy import Column, String, Float, Text, DateTime, func

from app.db.session import Base


class TemplateFormula(Base):
    __tablename__ = "template_formulas"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    template_version_id = Column(String(36), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    target_column = Column(String(10), nullable=False)   # column letter e.g. "E"
    formula_type = Column(String(20), nullable=False, default="column")  # column | single_cell
    expression = Column(String(500), nullable=False)     # e.g. "=O{row}/N{row}" or "=SUM(A2:A100)"
    weight = Column(Float, nullable=True)
    benchmark = Column(Float, nullable=True)
    scoring_rules = Column(Text, nullable=True)          # JSON: [{"min": 0, "max": 0.01, "score": 90}]
    created_by = Column(String(36), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
```

- [ ] **Step 4: Export TemplateFormula from models/__init__.py**

```python
from app.models.user import User
from app.models.record import Record
from app.models.uploaded_file import UploadedFile
from app.models.conversation import ConversationMessage
from app.models.session import SessionModel
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.template import Template
from app.models.template_version import TemplateVersion
from app.models.template_assignment import TemplateAssignment
from app.models.submission import Submission
from app.models.consolidated_sheet import ConsolidatedSheet
from app.models.formula import Formula
from app.models.template_formula import TemplateFormula

__all__ = [
    "User", "Record", "UploadedFile", "ConversationMessage", "SessionModel",
    "Project", "ProjectMember", "Template", "TemplateVersion", "TemplateAssignment",
    "Submission", "ConsolidatedSheet", "Formula", "TemplateFormula",
]
```

- [ ] **Step 5: Write the Alembic migration**

Create `backend/migrations/versions/e1f2a3b4c5d6_locking_and_formula_engine.py`:

```python
"""Add locking columns, processed_file_path, and template_formulas table

Revision ID: e1f2a3b4c5d6
Revises: d1e2f3a4b5c6
Create Date: 2026-05-05

"""
from alembic import op
import sqlalchemy as sa

revision = 'e1f2a3b4c5d6'
down_revision = 'd1e2f3a4b5c6'
branch_labels = None
depends_on = None


def upgrade():
    # template_assignments: add locked_at, locked_by
    with op.batch_alter_table('template_assignments') as batch_op:
        batch_op.add_column(sa.Column('locked_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('locked_by', sa.String(36), nullable=True))

    # submissions: add processed_file_path
    with op.batch_alter_table('submissions') as batch_op:
        batch_op.add_column(sa.Column('processed_file_path', sa.String(500), nullable=True))

    # template_formulas: new table
    op.create_table(
        'template_formulas',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('template_version_id', sa.String(36), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('target_column', sa.String(10), nullable=False),
        sa.Column('formula_type', sa.String(20), nullable=False),
        sa.Column('expression', sa.String(500), nullable=False),
        sa.Column('weight', sa.Float(), nullable=True),
        sa.Column('benchmark', sa.Float(), nullable=True),
        sa.Column('scoring_rules', sa.Text(), nullable=True),
        sa.Column('created_by', sa.String(36), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )


def downgrade():
    op.drop_table('template_formulas')
    with op.batch_alter_table('submissions') as batch_op:
        batch_op.drop_column('processed_file_path')
    with op.batch_alter_table('template_assignments') as batch_op:
        batch_op.drop_column('locked_by')
        batch_op.drop_column('locked_at')
```

- [ ] **Step 6: Run migration**

```bash
cd backend
PYTHONPATH=. .venv/bin/alembic upgrade head
```

Expected: 3 operations complete with no errors.

- [ ] **Step 7: Write failing model tests**

Extend `backend/tests/unit/test_submission_models.py`:

```python
def test_assignment_lock_columns(db):
    from app.models.template_assignment import TemplateAssignment
    from datetime import datetime
    a = TemplateAssignment(id="asn-2", org_id="org-1", submission_type="template", status="locked",
                           locked_by="user-1", locked_at=datetime(2026, 5, 1))
    db.add(a)
    db.commit()
    db.refresh(a)
    assert a.locked_by == "user-1"
    assert a.locked_at == datetime(2026, 5, 1)


def test_submission_processed_file_path(db):
    from app.models.submission import Submission
    s = Submission(
        id="sub-2", assignment_id="asn-1", org_id="org-1",
        file_path="/data/file.xlsx", file_name="report.xlsx",
        processed_file_path="/data/file_processed.xlsx"
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    assert s.processed_file_path == "/data/file_processed.xlsx"


def test_template_formula_model(db):
    from app.models.template_formula import TemplateFormula
    f = TemplateFormula(
        id="frm-1", template_version_id="ver-1", name="TRIR",
        target_column="E", formula_type="column", expression="=O{row}/N{row}",
        weight=0.2, benchmark=0.95,
        scoring_rules='[{"min": null, "max": 0.01, "score": 100}]'
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    assert f.weight == 0.2
    assert f.formula_type == "column"
```

- [ ] **Step 8: Run tests — expect PASS**

```bash
cd backend
PYTHONPATH=. .venv/bin/pytest tests/unit/test_submission_models.py -v
```

Expected: all tests pass (SQLite in-memory, no MySQL needed).

- [ ] **Step 9: Commit**

```bash
git add backend/app/models/ backend/migrations/ backend/tests/unit/test_submission_models.py
git commit -m "feat: add locking columns, processed_file_path, TemplateFormula model + migration"
```

---

### Task 2: Lock/Unlock admin endpoints

**Files:**
- Modify: `backend/app/api/routes/admin.py`
- Create: `backend/tests/integration/test_locking.py`

- [ ] **Step 1: Write failing integration tests**

Create `backend/tests/integration/test_locking.py`:

```python
"""Integration tests — assignment lock/unlock endpoints."""
import pytest


@pytest.fixture
def pif_admin_client(client, db, test_user):
    """Patch test_user role to pif_admin."""
    test_user.role = "pif_admin"
    db.commit()
    return client


@pytest.fixture
def assignment(db):
    from app.models.template_assignment import TemplateAssignment
    a = TemplateAssignment(id="asn-lock-1", org_id="org-1", submission_type="template", status="submitted")
    db.add(a)
    db.commit()
    return a


def test_lock_assignment(pif_admin_client, assignment):
    resp = pif_admin_client.post(f"/api/admin/assignments/{assignment.id}/lock")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "locked"
    assert data["locked_at"] is not None
    assert data["locked_by"] is not None


def test_lock_already_locked(pif_admin_client, assignment, db):
    assignment.status = "locked"
    db.commit()
    resp = pif_admin_client.post(f"/api/admin/assignments/{assignment.id}/lock")
    assert resp.status_code == 409


def test_unlock_assignment(pif_admin_client, assignment, db):
    assignment.status = "locked"
    db.commit()
    resp = pif_admin_client.post(f"/api/admin/assignments/{assignment.id}/unlock")
    assert resp.status_code == 200
    assert resp.json()["status"] == "submitted"


def test_lock_requires_pif_admin(client, assignment):
    resp = client.post(f"/api/admin/assignments/{assignment.id}/lock")
    assert resp.status_code in (401, 403)
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
PYTHONPATH=. .venv/bin/pytest tests/integration/test_locking.py -v
```

Expected: FAIL (endpoints don't exist yet).

- [ ] **Step 3: Add lock/unlock endpoints to admin.py**

At the end of `backend/app/api/routes/admin.py`, add:

```python
# ── Assignment Lock / Unlock ─────────────────────────────────────────────────

class AssignmentLockResponse(BaseModel):
    id: str
    status: str
    locked_at: Optional[datetime] = None
    locked_by: Optional[str] = None

    model_config = {"from_attributes": True}


@router.post("/assignments/{assignment_id}/lock", response_model=AssignmentLockResponse)
def lock_assignment(
    assignment_id: str,
    user: User = Depends(require_pif_admin),
    db: Session = Depends(get_db),
):
    """Lock a submission — no further uploads accepted from the DevCo."""
    a = db.query(TemplateAssignment).filter(TemplateAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if a.status == "locked":
        raise HTTPException(status_code=409, detail="Assignment already locked")
    from datetime import datetime as dt
    a.status = "locked"
    a.locked_at = dt.utcnow()
    a.locked_by = str(user.id)
    db.commit()
    db.refresh(a)
    return a


@router.post("/assignments/{assignment_id}/unlock", response_model=AssignmentLockResponse)
def unlock_assignment(
    assignment_id: str,
    user: User = Depends(require_pif_admin),
    db: Session = Depends(get_db),
):
    """Unlock a submission — allows DevCo to resubmit."""
    a = db.query(TemplateAssignment).filter(TemplateAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    a.status = "submitted"
    a.locked_at = None
    a.locked_by = None
    db.commit()
    db.refresh(a)
    return a
```

You also need these imports at the top of admin.py (add any that are missing):

```python
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.template_assignment import TemplateAssignment
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
PYTHONPATH=. .venv/bin/pytest tests/integration/test_locking.py -v
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/routes/admin.py backend/tests/integration/test_locking.py
git commit -m "feat: assignment lock/unlock endpoints"
```

---

## Chunk 2: Formula Engine

### Task 3: Pydantic schemas for formula CRUD

**Files:**
- Create: `backend/app/schemas/template_formula.py`

- [ ] **Step 1: Create schemas file**

```python
"""Pydantic schemas for TemplateFormula CRUD."""

from __future__ import annotations
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel


class TemplateFormulaCreate(BaseModel):
    name: str
    target_column: str                    # e.g. "E"
    formula_type: str = "column"          # "column" | "single_cell"
    expression: str                       # e.g. "=O{row}/N{row}"
    weight: Optional[float] = None
    benchmark: Optional[float] = None
    scoring_rules: Optional[Any] = None   # list of {min, max, score} dicts


class TemplateFormulaUpdate(BaseModel):
    name: Optional[str] = None
    target_column: Optional[str] = None
    formula_type: Optional[str] = None
    expression: Optional[str] = None
    weight: Optional[float] = None
    benchmark: Optional[float] = None
    scoring_rules: Optional[Any] = None


class TemplateFormulaResponse(BaseModel):
    id: str
    template_version_id: str
    name: str
    target_column: str
    formula_type: str
    expression: str
    weight: Optional[float]
    benchmark: Optional[float]
    scoring_rules: Optional[Any]
    created_by: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/template_formula.py
git commit -m "feat: TemplateFormula Pydantic schemas"
```

---

### Task 4: Formula CRUD endpoints

**Files:**
- Modify: `backend/app/api/routes/admin.py`
- Create: `backend/tests/integration/test_formula_crud.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/integration/test_formula_crud.py`:

```python
"""Integration tests — template formula CRUD."""
import pytest


@pytest.fixture
def pif_admin_client(client, db, test_user):
    test_user.role = "pif_admin"
    db.commit()
    return client


@pytest.fixture
def template_version(db):
    from app.models.template import Template
    from app.models.template_version import TemplateVersion
    t = Template(id="tmpl-1", name="KPI Template", status="active", template_type="subcontractor")
    db.add(t)
    v = TemplateVersion(id="ver-1", template_id="tmpl-1", version_number=1,
                        schema_json='{"columns": []}', created_by=None)
    db.add(v)
    db.commit()
    return v


def test_create_formula(pif_admin_client, template_version):
    resp = pif_admin_client.post(f"/api/admin/template-versions/{template_version.id}/formulas", json={
        "name": "TRIR",
        "target_column": "E",
        "formula_type": "column",
        "expression": "=O{row}/N{row}",
        "weight": 0.2,
        "benchmark": 0.95,
        "scoring_rules": [{"min": None, "max": 0.01, "score": 100}],
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "TRIR"
    assert data["template_version_id"] == template_version.id


def test_list_formulas(pif_admin_client, template_version, db):
    from app.models.template_formula import TemplateFormula
    f = TemplateFormula(id="frm-1", template_version_id=template_version.id,
                        name="Test", target_column="B", formula_type="column",
                        expression="=A{row}/2")
    db.add(f)
    db.commit()
    resp = pif_admin_client.get(f"/api/admin/template-versions/{template_version.id}/formulas")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_update_formula(pif_admin_client, template_version, db):
    from app.models.template_formula import TemplateFormula
    f = TemplateFormula(id="frm-2", template_version_id=template_version.id,
                        name="Old", target_column="C", formula_type="column",
                        expression="=A{row}")
    db.add(f)
    db.commit()
    resp = pif_admin_client.put(f"/api/admin/formulas/frm-2", json={"name": "New"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "New"


def test_delete_formula(pif_admin_client, template_version, db):
    from app.models.template_formula import TemplateFormula
    f = TemplateFormula(id="frm-3", template_version_id=template_version.id,
                        name="Del", target_column="D", formula_type="column",
                        expression="=A{row}")
    db.add(f)
    db.commit()
    resp = pif_admin_client.delete(f"/api/admin/formulas/frm-3")
    assert resp.status_code == 204
    assert db.query(TemplateFormula).filter_by(id="frm-3").first() is None
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
PYTHONPATH=. .venv/bin/pytest tests/integration/test_formula_crud.py -v
```

Expected: FAIL (endpoints don't exist).

- [ ] **Step 3: Add formula CRUD to admin.py**

Add these imports to admin.py (if not present):

```python
import json
from app.models.template_formula import TemplateFormula
from app.schemas.template_formula import (
    TemplateFormulaCreate, TemplateFormulaUpdate, TemplateFormulaResponse,
)
```

Add these endpoints to `backend/app/api/routes/admin.py`:

```python
# ── Template Formula CRUD ────────────────────────────────────────────────────

@router.get(
    "/template-versions/{version_id}/formulas",
    response_model=list[TemplateFormulaResponse],
)
def list_formulas(
    version_id: str,
    user: User = Depends(require_pif_admin),
    db: Session = Depends(get_db),
):
    return db.query(TemplateFormula).filter(
        TemplateFormula.template_version_id == version_id
    ).all()


@router.post(
    "/template-versions/{version_id}/formulas",
    response_model=TemplateFormulaResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_formula(
    version_id: str,
    body: TemplateFormulaCreate,
    user: User = Depends(require_pif_admin),
    db: Session = Depends(get_db),
):
    import uuid as _uuid
    f = TemplateFormula(
        id=str(_uuid.uuid4()),
        template_version_id=version_id,
        name=body.name,
        target_column=body.target_column,
        formula_type=body.formula_type,
        expression=body.expression,
        weight=body.weight,
        benchmark=body.benchmark,
        scoring_rules=json.dumps(body.scoring_rules) if body.scoring_rules is not None else None,
        created_by=str(user.id),
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


@router.put("/formulas/{formula_id}", response_model=TemplateFormulaResponse)
def update_formula(
    formula_id: str,
    body: TemplateFormulaUpdate,
    user: User = Depends(require_pif_admin),
    db: Session = Depends(get_db),
):
    f = db.query(TemplateFormula).filter(TemplateFormula.id == formula_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Formula not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        if field == "scoring_rules" and val is not None:
            val = json.dumps(val)
        setattr(f, field, val)
    db.commit()
    db.refresh(f)
    return f


@router.delete("/formulas/{formula_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_formula(
    formula_id: str,
    user: User = Depends(require_pif_admin),
    db: Session = Depends(get_db),
):
    f = db.query(TemplateFormula).filter(TemplateFormula.id == formula_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Formula not found")
    db.delete(f)
    db.commit()
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
PYTHONPATH=. .venv/bin/pytest tests/integration/test_formula_crud.py -v
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/routes/admin.py backend/tests/integration/test_formula_crud.py
git commit -m "feat: formula CRUD endpoints"
```

---

### Task 5: FormulaExecutor service

**Files:**
- Create: `backend/app/services/formula_executor.py`
- Create: `backend/tests/unit/test_formula_executor.py`

Context: `xlcalculator` evaluates Excel formulas from an xlsx file. Cell addresses use the format `SheetName!A1`. The executor:
1. Loads submitted xlsx with openpyxl
2. Detects the data row range (row 2 to last populated row)
3. For `column` formulas: expands `{row}` placeholder for each data row, writes formula strings into target column cells
4. For `single_cell` formulas: writes formula string directly to the target cell
5. Saves to a BytesIO buffer, loads into xlcalculator, evaluates all formula cells
6. Reads computed numeric values, writes them back as plain numbers (so consolidation can read them)
7. Applies scoring rules if present
8. Returns final xlsx as bytes

- [ ] **Step 1: Add xlcalculator to requirements.txt**

```
xlcalculator==0.6.0
```

Add it after the `openpyxl` line in `backend/requirements.txt`.

Verify installed version:
```bash
cd backend && .venv/bin/pip install xlcalculator -q && .venv/bin/pip show xlcalculator | grep Version
```

- [ ] **Step 2: Write failing unit tests**

Create `backend/tests/unit/test_formula_executor.py`:

```python
"""Unit tests for FormulaExecutor."""

import io
import json
import openpyxl
import pytest


def make_xlsx(rows: list[dict]) -> bytes:
    """Build a simple xlsx from a list of row dicts keyed by column letter."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sheet1"
    if not rows:
        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()

    # Write header row (row 1): column letters as headers
    col_letters = list(rows[0].keys())
    for i, letter in enumerate(col_letters, start=1):
        ws.cell(row=1, column=i, value=letter)

    # Write data rows starting at row 2
    col_index = {letter: i for i, letter in enumerate(col_letters, start=1)}
    for row_idx, row_data in enumerate(rows, start=2):
        for letter, value in row_data.items():
            ws.cell(row=row_idx, column=col_index[letter], value=value)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def make_formula(target_column, formula_type, expression, weight=None,
                 benchmark=None, scoring_rules=None):
    """Build a minimal TemplateFormula-like object."""
    class F:
        pass
    f = F()
    f.target_column = target_column
    f.formula_type = formula_type
    f.expression = expression
    f.weight = weight
    f.benchmark = benchmark
    f.scoring_rules = json.dumps(scoring_rules) if scoring_rules else None
    return f


def test_column_formula_divides_values():
    """=O{row}/N{row} should produce O/N for each data row."""
    from app.services.formula_executor import FormulaExecutor
    xlsx_bytes = make_xlsx([
        {"N": 10.0, "O": 5.0},
        {"N": 20.0, "O": 4.0},
    ])
    formulas = [make_formula("P", "column", "=O{row}/N{row}")]
    result = FormulaExecutor.execute(xlsx_bytes, formulas)

    wb = openpyxl.load_workbook(io.BytesIO(result))
    ws = wb.active
    # Column N=1, O=2, P=3 (based on header row)
    # Find column P index
    headers = {ws.cell(row=1, column=c).value: c for c in range(1, ws.max_column + 1)}
    p_col = headers["P"]
    assert ws.cell(row=2, column=p_col).value == pytest.approx(0.5)
    assert ws.cell(row=3, column=p_col).value == pytest.approx(0.2)


def test_single_cell_formula_sum():
    """=SUM(N2:N3) should produce the sum of column N."""
    from app.services.formula_executor import FormulaExecutor
    xlsx_bytes = make_xlsx([{"N": 10.0}, {"N": 20.0}])
    formulas = [make_formula("P", "single_cell", "=SUM(N2:N3)")]
    result = FormulaExecutor.execute(xlsx_bytes, formulas)

    wb = openpyxl.load_workbook(io.BytesIO(result))
    ws = wb.active
    headers = {ws.cell(row=1, column=c).value: c for c in range(1, ws.max_column + 1)}
    p_col = headers["P"]
    assert ws.cell(row=2, column=p_col).value == pytest.approx(30.0)


def test_scoring_rules_applied():
    """Values should be mapped to scores based on scoring_rules."""
    from app.services.formula_executor import FormulaExecutor
    xlsx_bytes = make_xlsx([{"N": 10.0, "O": 1.0}])  # O/N = 0.1
    scoring = [
        {"min": None, "max": 0.05, "score": 100},
        {"min": 0.05, "max": 0.2, "score": 80},
        {"min": 0.2, "max": None, "score": 0},
    ]
    formulas = [make_formula("P", "column", "=O{row}/N{row}", scoring_rules=scoring)]
    result = FormulaExecutor.execute(xlsx_bytes, formulas)

    wb = openpyxl.load_workbook(io.BytesIO(result))
    ws = wb.active
    headers = {ws.cell(row=1, column=c).value: c for c in range(1, ws.max_column + 1)}
    # Score column is written next to target column (target + "_score" header)
    score_col = headers.get("P_score")
    assert score_col is not None
    assert ws.cell(row=2, column=score_col).value == 80


def test_no_formulas_returns_original():
    """If formulas list is empty, return original bytes unchanged."""
    from app.services.formula_executor import FormulaExecutor
    xlsx_bytes = make_xlsx([{"A": 1.0}])
    result = FormulaExecutor.execute(xlsx_bytes, [])
    assert result == xlsx_bytes


def test_weighted_score_summary():
    """Weighted total should be written to a summary cell when weights are present."""
    from app.services.formula_executor import FormulaExecutor
    scoring = [{"min": None, "max": 0.05, "score": 100}, {"min": 0.05, "max": None, "score": 0}]
    xlsx_bytes = make_xlsx([{"N": 10.0, "O": 0.2}])  # O/N = 0.02 → score 100
    formulas = [make_formula("P", "column", "=O{row}/N{row}", weight=0.5, scoring_rules=scoring)]
    result = FormulaExecutor.execute(xlsx_bytes, formulas)

    wb = openpyxl.load_workbook(io.BytesIO(result))
    ws = wb.active
    # Look for a cell containing "Weighted Score" label
    found = False
    for row in ws.iter_rows():
        for cell in row:
            if cell.value == "Weighted Score":
                found = True
    assert found
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
PYTHONPATH=. .venv/bin/pytest tests/unit/test_formula_executor.py -v
```

Expected: FAIL (FormulaExecutor doesn't exist yet).

- [ ] **Step 4: Implement FormulaExecutor**

Create `backend/app/services/formula_executor.py`:

```python
"""FormulaExecutor — applies Excel formulas to submitted xlsx files."""

from __future__ import annotations

import io
import json
import logging
from typing import Any

import openpyxl
from xlcalculator import ModelCompiler, Evaluator

logger = logging.getLogger(__name__)

# Column letter → 1-based index (A=1, B=2, ... Z=26, AA=27, ...)
def _col_letter_to_index(letter: str) -> int:
    letter = letter.upper()
    result = 0
    for char in letter:
        result = result * 26 + (ord(char) - ord('A') + 1)
    return result


def _col_index_to_letter(index: int) -> str:
    result = ""
    while index > 0:
        index, remainder = divmod(index - 1, 26)
        result = chr(ord('A') + remainder) + result
    return result


def _apply_scoring(value: float, rules: list[dict]) -> int | None:
    """Map a numeric value to a score using range rules. Rules checked in order."""
    if value is None:
        return None
    for rule in rules:
        lo = rule.get("min")
        hi = rule.get("max")
        if (lo is None or value >= lo) and (hi is None or value <= hi):
            return rule.get("score")
    return None


class FormulaExecutor:

    @staticmethod
    def execute(xlsx_bytes: bytes, formulas: list[Any]) -> bytes:
        """
        Apply formulas to an xlsx file and return modified bytes.

        formulas: list of TemplateFormula ORM objects (or duck-typed equivalents).
        Each has: target_column, formula_type, expression, weight, benchmark, scoring_rules (JSON string).

        Returns original bytes unchanged if formulas list is empty.
        """
        if not formulas:
            return xlsx_bytes

        wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes))
        ws = wb.active
        sheet_name = ws.title

        # Build header → column-index map from row 1
        header_to_col: dict[str, int] = {}
        for col_idx in range(1, ws.max_column + 1):
            header = ws.cell(row=1, column=col_idx).value
            if header:
                header_to_col[str(header)] = col_idx

        # Detect data rows: row 2 through last row with any data
        data_start = 2
        data_end = ws.max_row

        # ── Write formula strings into cells ─────────────────────────────────
        target_col_indices: dict[str, int] = {}  # target_column letter → col index

        for formula in formulas:
            target = formula.target_column.upper()

            # Determine target column index: use existing header if present,
            # otherwise append a new column
            if target in header_to_col:
                target_col_idx = header_to_col[target]
            else:
                target_col_idx = ws.max_column + 1
                ws.cell(row=1, column=target_col_idx, value=target)
                header_to_col[target] = target_col_idx

            target_col_indices[target] = target_col_idx

            if formula.formula_type == "column":
                for row in range(data_start, data_end + 1):
                    cell_formula = formula.expression.replace("{row}", str(row))
                    ws.cell(row=row, column=target_col_idx, value=cell_formula)
            else:
                # single_cell: write formula once, in the data_start row of target column
                ws.cell(row=data_start, column=target_col_idx, value=formula.expression)

        # ── Evaluate with xlcalculator ────────────────────────────────────────
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)

        try:
            compiler = ModelCompiler()
            model = compiler.read_and_parse_archive(buf, ignore_sheets=[])
            evaluator = Evaluator(model)
        except Exception as exc:
            logger.warning("xlcalculator failed to parse workbook: %s — returning unprocessed file", exc)
            buf.seek(0)
            return buf.read()

        # ── Write computed values back (replace formula strings with numbers) ─
        scored_cols: list[tuple[str, list[dict], int]] = []  # (target, rules, col_idx)
        weighted: list[tuple[float, float]] = []  # (weight, score)

        for formula in formulas:
            target = formula.target_column.upper()
            target_col_idx = target_col_indices[target]
            scoring_rules = json.loads(formula.scoring_rules) if formula.scoring_rules else []

            if formula.formula_type == "column":
                for row in range(data_start, data_end + 1):
                    cell_addr = f"{sheet_name}!{_col_index_to_letter(target_col_idx)}{row}"
                    try:
                        computed = evaluator.evaluate(cell_addr)
                        numeric = float(computed) if computed not in (None, "") else None
                    except Exception:
                        numeric = None
                    ws.cell(row=row, column=target_col_idx, value=numeric)

                    # Apply scoring per row
                    if scoring_rules and numeric is not None:
                        score = _apply_scoring(numeric, scoring_rules)
                        # Write score to a "_score" header column
                        score_header = f"{target}_score"
                        if score_header not in header_to_col:
                            score_col_idx = ws.max_column + 1
                            ws.cell(row=1, column=score_col_idx, value=score_header)
                            header_to_col[score_header] = score_col_idx
                        else:
                            score_col_idx = header_to_col[score_header]
                        ws.cell(row=row, column=score_col_idx, value=score)

                        # Collect for weighted total (use first data row score as representative)
                        if formula.weight and row == data_start:
                            weighted.append((formula.weight, score or 0))

            else:
                # single_cell
                cell_addr = f"{sheet_name}!{_col_index_to_letter(target_col_idx)}{data_start}"
                try:
                    computed = evaluator.evaluate(cell_addr)
                    numeric = float(computed) if computed not in (None, "") else None
                except Exception:
                    numeric = None
                ws.cell(row=data_start, column=target_col_idx, value=numeric)

        # ── Append weighted score summary ─────────────────────────────────────
        if weighted:
            total_weight = sum(w for w, _ in weighted)
            weighted_score = (
                sum(w * s for w, s in weighted) / total_weight
                if total_weight > 0 else 0
            )
            summary_row = data_end + 2
            ws.cell(row=summary_row, column=1, value="Weighted Score")
            ws.cell(row=summary_row, column=2, value=round(weighted_score, 2))

        result_buf = io.BytesIO()
        wb.save(result_buf)
        return result_buf.getvalue()
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
PYTHONPATH=. .venv/bin/pytest tests/unit/test_formula_executor.py -v
```

Expected: all 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/formula_executor.py backend/tests/unit/test_formula_executor.py backend/requirements.txt
git commit -m "feat: FormulaExecutor service with xlcalculator"
```

---

### Task 6: Wire FormulaExecutor into submit endpoint

**Files:**
- Modify: `backend/app/api/routes/subcontractor.py`

- [ ] **Step 1: Add imports to subcontractor.py**

At the top of `backend/app/api/routes/subcontractor.py`, add:

```python
from app.models.template_formula import TemplateFormula
from app.services.formula_executor import FormulaExecutor
```

- [ ] **Step 2: Wire executor after file save**

In the `submit_file` endpoint, after `a.status = "submitted"` and before `db.commit()`, add:

```python
    # ── Apply formulas if template version has any ────────────────────────
    if a.template_version_id:
        formulas = db.query(TemplateFormula).filter(
            TemplateFormula.template_version_id == a.template_version_id
        ).all()
        if formulas:
            try:
                processed_bytes = FormulaExecutor.execute(content, formulas)
                processed_path = org_dir / f"{sha}_processed{ext}"
                processed_path.write_bytes(processed_bytes)
                if existing:
                    existing.processed_file_path = str(processed_path)
                else:
                    sub.processed_file_path = str(processed_path)
            except Exception as exc:
                import logging
                logging.getLogger(__name__).warning(
                    "Formula execution failed for submission %s: %s", sub.id, exc
                )
                # Non-fatal: submission succeeds even if formula processing fails
```

- [ ] **Step 3: Update SubmissionResponse schema**

In `backend/app/schemas/subcontractor.py`, add `processed_file_path` to `SubmissionResponse`:

```python
class SubmissionResponse(BaseModel):
    id: str
    assignment_id: str
    org_id: str
    file_name: str
    status: str
    submitted_at: datetime
    submitted_by: Optional[str]
    processed_file_path: Optional[str] = None

    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Update consolidation to prefer processed file**

In `backend/app/api/routes/admin.py`, wherever submissions are read for consolidation (look for `sub.file_path`), update to:

```python
file_to_read = sub.processed_file_path or sub.file_path
```

Search for this pattern:
```bash
grep -n "sub\.file_path\|\.file_path" backend/app/api/routes/admin.py | head -20
```

- [ ] **Step 5: Run full test suite**

```bash
cd backend
PYTHONPATH=. .venv/bin/pytest -v
```

Expected: all tests pass. Coverage should remain ≥ 80%.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/routes/subcontractor.py backend/app/schemas/subcontractor.py backend/app/api/routes/admin.py
git commit -m "feat: wire FormulaExecutor into submit endpoint, prefer processed file in consolidation"
```

---

## Unresolved Questions

- `xlcalculator` version: pin to `0.6.0` or latest? Run `pip show xlcalculator` after install to confirm version and pin exactly.
- If a DevCo resubmits after a formula change (PIF updated formulas), the old `_processed` file should be overwritten — the current wiring using `sha` in the filename handles this naturally since same content = same hash.
- Weighted score summary: currently uses only the first data row's score per formula. If DevCo submits multiple rows per KPI, clarify whether weight applies per row or per formula across all rows.
