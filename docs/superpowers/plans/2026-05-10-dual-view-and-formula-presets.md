# Dual View (Raw/Calculated) + Safety KPI Formula Presets

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Let PIF admins toggle between raw and calculated submission views (raw is read-only DevCo submission; calculated is editable admin working copy with Recalculate option). (2) AI-driven formula configuration: admin triggers AI to inspect a template's `.xlsx` layout, AI asks clarifying questions (header row, data range, etc.), then generates the correct `TemplateFormula` records — works for any template layout, not just Safety. (3) Fix FormulaExecutor to handle absolute cell references.

**Architecture:**
- The Safety KPI template has formulas embedded as Excel cell formulas (row 16 = SUM, row 17 = KPI rates). However, the fill-online submit path **strips all formulas** (`hot.getData()` → `aoa_to_sheet` loses them). Upload path may preserve them.
- Therefore FormulaExecutor must re-inject formulas from `template_formulas` DB records into the raw submitted file, evaluate, and save as `_processed.xlsx`.
- FormulaExecutor currently has 3 bugs for this use case: (a) reads headers from row 1, (b) writes single_cell formulas to row 2, (c) regex tries to translate absolute cell refs. Must fix these.
- **Formula configuration is AI-driven:** instead of hard-coding formulas per template type, the admin triggers an AI conversation that inspects the template `.xlsx`, auto-detects layout (headers, data rows, formula rows), asks the admin to confirm/correct, and generates `TemplateFormula` records. This works for Safety, Quality, or any future template layout.
- **Dual view model:** Raw file = immutable DevCo submission (read-only). Calculated file = admin's editable working copy (initialized from raw + formulas). "Recalculate" button re-derives calculated from raw + formulas, discarding manual edits (with confirmation).

**Tech Stack:** FastAPI, SQLAlchemy, Vue 3, TypeScript, Handsontable, openpyxl, xlcalculator

**Source of truth for formulas:** `Project-Documents/KPI/Safety/Formula.xlsx`

### Safety KPI Formulas (from Formula.xlsx)

| # | KPI | Weight | Excel Formula | Scoring Criteria |
|---|-----|--------|---------------|------------------|
| 1 | Fatality Rate (FR) | 0.20 | `=H16*200000/F16` | 0→100%, ≤0.01→90%, ≤0.05→80%, ≤0.1→70%, >0.1→0% |
| 2 | LTIFR | 0.10 | `=I16*200000/F16` | 0→100%, ≤0.04→90%, ≤0.1→80%, ≤0.2→70%, >0.2→0% |
| 3 | TRIR | 0.10 | `=K16*200000/F16` | 0→100%, ≤0.045→90%, ≤0.09→80%, ≤0.15→70%, >0.15→0% |
| 4 | Near Miss Rate | 0.15 | `=L16*200000/F16` | >40→100%, 30-40→90%, 20-30→80%, 10-20→70%, <10→60%, 0→0% |
| 5 | Safety Observation Rate | 0.15 | `=M16*200000/F16` | >100→100%, 80-100→90%, 60-80→80%, 40-60→70%, <40→0% |
| 6 | Leadership Engagement Rate | 0.15 | `=N16*200000/F16` | >7→100%, 5-7→95%, 3-5→90%, 2-3→85%, <2→80%, 0→0% |
| 7 | Incentive Programs Rate | 0.15 | `=O16*200000/F16` | >0.4→100%, 0.3-0.4→95%, 0.2-0.3→90%, 0.1-0.2→85%, <0.1→80%, 0→0% |

**Template column layout (ARD sheet, row 9):**
- F: Total No. of Manhours | G: Total safe manhours | H: No. of Fatality
- I: Lost Time Injury incidents | J: LTI manhours | K: Total Recordable Incident
- L: Total Near Miss | M: Total Safety Observations | N: Leadership walks | O: Rewards

**Row 16:** `=SUM(col10:col14)` for each column | **Row 17:** KPI rate formulas

### Critical finding: fill-online strips formulas

`SubcontractorTemplateEditorView.vue:52-56` does:
```javascript
const data = hot.getData()                // raw cell VALUES only — formulas lost
const ws = XLSX.utils.aoa_to_sheet(data)  // new sheet from values
const wb = XLSX.utils.book_new()          // brand new workbook
```
The submitted file has NO formulas. FormulaExecutor must re-inject them.

### FormulaExecutor bugs to fix (`backend/app/services/formula_executor.py`)

| Bug | Current behavior | Needed behavior |
|-----|-----------------|-----------------|
| Header row | Reads row 1 (line 74) | Safety template has headers on row 9. Need configurable or auto-detect. |
| single_cell placement | Writes to `data_start` = row 2 (line 106) | Formulas have absolute refs (`=H16*200000/F16`). Should write to the row specified IN the formula, or a configurable target row. |
| Column translation | Regex replaces `H16` → looks up `H` as header (line 39) | Absolute refs should pass through unchanged. Only translate `{row}` placeholder formulas. |

---

## Chunk 1: Fix FormulaExecutor for absolute cell references

### Task 1: Fix FormulaExecutor to handle Safety KPI formulas

**Files:**
- Modify: `backend/app/services/formula_executor.py`
- Modify: `backend/app/models/template_formula.py`
- Create: `backend/tests/unit/test_formula_executor_absolute.py`

- [ ] **Step 1: Add `target_row` column to TemplateFormula model**

In `backend/app/models/template_formula.py`, add:

```python
target_row = Column(Integer, nullable=True)  # row to write formula into; None = auto (data rows for column type)
target_sheet = Column(String(100), nullable=True)  # sheet name to write to; None = active sheet
```

`target_row` lets single_cell formulas specify exactly which row to write to (e.g., row 16 for SUMs, row 17 for KPI rates).
`target_sheet` lets formulas target a specific worksheet instead of always using `wb.active`. This is required for multi-sheet workbooks where formulas or editable regions exist outside the active sheet.

- [ ] **Step 2: Add `target_row` to schemas (end-to-end)**

In `backend/app/schemas/template_formula.py`, add `target_row` to all schemas:

```python
class TemplateFormulaCreate(BaseModel):
    name: str
    target_column: str
    formula_type: str = "column"
    expression: str
    target_row: int | None = None      # ← ADD: row to write formula into
    target_sheet: str | None = None    # ← ADD: sheet name; None = active sheet
    weight: float | None = None
    benchmark: float | None = None
    scoring_rules: Any | None = None

class TemplateFormulaUpdate(BaseModel):
    name: str | None = None
    target_column: str | None = None
    formula_type: str | None = None
    expression: str | None = None
    target_row: int | None = None      # ← ADD
    target_sheet: str | None = None    # ← ADD
    weight: float | None = None
    benchmark: float | None = None
    scoring_rules: Any | None = None

class TemplateFormulaResponse(BaseModel):
    id: str
    template_version_id: str
    name: str
    target_column: str
    formula_type: str
    expression: str
    target_row: int | None = None      # ← ADD
    target_sheet: str | None = None    # ← ADD
    weight: float | None = None
    benchmark: float | None = None
    scoring_rules: Any | None = None
    created_by: str | None = None
```

This ensures `target_row` and `target_sheet` round-trip through all CRUD endpoints and the AI bulk-save flow.

- [ ] **Step 3: Create Alembic migration for target_row**

```bash
cd backend && alembic revision --autogenerate -m "add target_row to template_formulas"
```

Verify migration adds the column, then run:

```bash
cd backend && alembic upgrade head
```

- [ ] **Step 4: Write failing test for absolute ref formulas**

Create `backend/tests/unit/test_formula_executor_absolute.py`:

```python
"""Test FormulaExecutor with absolute cell references (Safety KPI style)."""
import io
import openpyxl
import pytest
from app.services.formula_executor import FormulaExecutor


class FakeFormula:
    """Duck-typed TemplateFormula for testing."""
    def __init__(self, name, target_column, formula_type, expression,
                 target_row=None, weight=None, scoring_rules=None):
        self.name = name
        self.target_column = target_column
        self.formula_type = formula_type
        self.expression = expression
        self.target_row = target_row
        self.weight = weight
        self.benchmark = None
        self.scoring_rules = scoring_rules


def _make_safety_xlsx() -> bytes:
    """Create a minimal Safety KPI template with data in rows 10-14, headers in row 9."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "ARD"
    # Row 9: headers
    ws["F9"] = "Total No. of Manhours"
    ws["H9"] = "No. of Fatality in the project"
    ws["I9"] = "Lost Time Injury incidents"
    # Row 10-12: data
    ws["F10"] = 100000
    ws["F11"] = 200000
    ws["H10"] = 0
    ws["H11"] = 1
    ws["I10"] = 2
    ws["I11"] = 3
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_absolute_ref_sum_formula():
    """SUM formula with absolute ref should be written to target_row."""
    xlsx = _make_safety_xlsx()
    formulas = [
        FakeFormula(
            name="Total Manhours",
            target_column="F",
            formula_type="single_cell",
            expression="=SUM(F10:F14)",
            target_row=16,
        ),
    ]
    result = FormulaExecutor.execute(xlsx, formulas)

    wb = openpyxl.load_workbook(io.BytesIO(result))
    ws = wb.active
    # Should have computed value in F16: 100000 + 200000 = 300000
    val = ws["F16"].value
    assert val == 300000, f"Expected 300000, got {val}"


def test_absolute_ref_kpi_formula_end_to_end():
    """End-to-end: row-16 SUM totals feed row-17 KPI rate formulas."""
    xlsx = _make_safety_xlsx()
    formulas = [
        # Row 16: SUM totals (must evaluate first — order matters)
        FakeFormula(
            name="Total Manhours",
            target_column="F",
            formula_type="single_cell",
            expression="=SUM(F10:F14)",
            target_row=16,
        ),
        FakeFormula(
            name="Total Fatalities",
            target_column="H",
            formula_type="single_cell",
            expression="=SUM(H10:H14)",
            target_row=16,
        ),
        FakeFormula(
            name="Total LTI",
            target_column="I",
            formula_type="single_cell",
            expression="=SUM(I10:I14)",
            target_row=16,
        ),
        # Row 17: KPI rates (depend on row-16 totals)
        FakeFormula(
            name="Fatality Rate",
            target_column="H",
            formula_type="single_cell",
            expression="=H16*200000/F16",
            target_row=17,
            weight=0.20,
        ),
        FakeFormula(
            name="LTIFR",
            target_column="I",
            formula_type="single_cell",
            expression="=I16*200000/F16",
            target_row=17,
            weight=0.10,
        ),
    ]
    result = FormulaExecutor.execute(xlsx, formulas)

    wb = openpyxl.load_workbook(io.BytesIO(result))
    ws = wb.active

    # Row 16 totals: F=100000+200000=300000, H=0+1=1, I=2+3=5
    assert ws["F16"].value == 300000, f"F16: expected 300000, got {ws['F16'].value}"
    assert ws["H16"].value == 1, f"H16: expected 1, got {ws['H16'].value}"
    assert ws["I16"].value == 5, f"I16: expected 5, got {ws['I16'].value}"

    # Row 17 KPI rates: FR = 1*200000/300000 ≈ 0.6667, LTIFR = 5*200000/300000 ≈ 3.3333
    fr = ws["H17"].value
    assert fr is not None, "H17 (Fatality Rate) was not written"
    assert abs(fr - (1 * 200000 / 300000)) < 0.001, f"H17: expected ~0.6667, got {fr}"

    ltifr = ws["I17"].value
    assert ltifr is not None, "I17 (LTIFR) was not written"
    assert abs(ltifr - (5 * 200000 / 300000)) < 0.001, f"I17: expected ~3.3333, got {ltifr}"


def test_no_row_placeholder_passthrough():
    """Formulas without {row} should NOT have column letters translated."""
    xlsx = _make_safety_xlsx()
    formulas = [
        FakeFormula(
            name="Test",
            target_column="Z",
            formula_type="single_cell",
            expression="=H16*200000/F16",
            target_row=17,
        ),
    ]
    result = FormulaExecutor.execute(xlsx, formulas)

    # Just verify it doesn't crash and Z17 has a value
    wb = openpyxl.load_workbook(io.BytesIO(result))
    ws = wb.active
    assert ws["Z17"].value is not None or ws["Z17"].value == 0  # might be 0 if H16 is 0
```

- [ ] **Step 5: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/unit/test_formula_executor_absolute.py -v
```

Expected: FAIL — formulas written to wrong rows, column translation corrupts refs

- [ ] **Step 6: Fix FormulaExecutor**

Replace the core logic in `backend/app/services/formula_executor.py`:

**Sheet targeting:** Instead of always using `wb.active`, resolve the worksheet per formula using `target_sheet`. Group formulas by sheet to avoid repeated lookups:

```python
# At the top of execute(), after loading the workbook:
wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes))

# Group formulas by target sheet for efficient processing
from collections import defaultdict
formulas_by_sheet: dict[str, list] = defaultdict(list)
for formula in formulas:
    sheet_name = getattr(formula, 'target_sheet', None) or wb.active.title
    formulas_by_sheet[sheet_name].append(formula)

# Process each sheet independently
for sheet_name, sheet_formulas in formulas_by_sheet.items():
    if sheet_name not in wb.sheetnames:
        logger.warning("Sheet %r not found in workbook, skipping formulas", sheet_name)
        continue
    ws = wb[sheet_name]
    # ... existing per-sheet logic (header scan, formula write, evaluation) ...
```

**Column translation fix:**

```python
def _translate_formula_columns(expression: str, header_to_col: dict[str, int]) -> str:
    """Translate header names to column letters, but ONLY for {row} placeholder formulas.

    Formulas with absolute cell references (e.g., =H16*200000/F16) are returned unchanged.
    Formulas with {row} placeholders (e.g., =O{row}/N{row}) have header names translated.
    """
    if "{row}" not in expression:
        return expression  # absolute refs — pass through unchanged

    name_to_letter = {name: _col_index_to_letter(col_idx) for name, col_idx in header_to_col.items()}

    def replace(m: re.Match) -> str:
        col_name = m.group(1)
        row_part = m.group(2)
        return name_to_letter.get(col_name, col_name) + row_part

    return re.sub(r"([A-Z]+)(\{row\}|\d+)", replace, expression)
```

And fix the single_cell write logic:

```python
if formula.formula_type == "column":
    for row in range(data_start, data_end + 1):
        cell_formula = translated.replace("{row}", str(row))
        ws.cell(row=row, column=target_col_idx, value=cell_formula)
else:
    # single_cell: write to target_row if specified, else data_start
    write_row = getattr(formula, 'target_row', None) or data_start
    ws.cell(row=write_row, column=target_col_idx, value=translated)
```

And fix the evaluation for single_cell to use the correct row and sheet:

```python
else:
    # single_cell — use the resolved sheet_name (not wb.active.title)
    write_row = getattr(formula, 'target_row', None) or data_start
    cell_addr = f"{sheet_name}!{_col_index_to_letter(target_col_idx)}{write_row}"
    try:
        computed = evaluator.evaluate(cell_addr)
        numeric = float(computed) if computed not in (None, "") else None
    except Exception:
        numeric = None
    ws.cell(row=write_row, column=target_col_idx, value=numeric)

    if scoring_rules and numeric is not None:
        score = _apply_scoring(numeric, scoring_rules)
        if score is not None and formula.weight:
            weighted.append((formula.weight, score))
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/unit/test_formula_executor_absolute.py -v
```

Expected: PASS

- [ ] **Step 8: Run all existing formula tests to ensure no regression**

```bash
cd backend && python -m pytest tests/unit/test_formula_executor.py tests/unit/test_formulas.py -v
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add backend/app/services/formula_executor.py backend/app/models/template_formula.py backend/app/schemas/template_formula.py backend/tests/unit/test_formula_executor_absolute.py backend/migrations/versions/
git commit -m "fix: FormulaExecutor supports absolute cell refs + target_row end-to-end"
```

---

## Chunk 2: Dual View — Backend

### Task 2: Download endpoint supports raw/calculated toggle

**Files:**
- Modify: `backend/app/api/routes/submissions.py:31-46`
- Modify: `backend/tests/integration/test_admin_coverage.py`

- [ ] **Step 1: Write failing test for download with type=processed**

```python
def test_download_submission_processed(admin_client, db):
    """Download processed file when type=processed."""
    import os, tempfile
    from app.models.submission import Submission

    raw_dir = tempfile.mkdtemp()
    raw_path = os.path.join(raw_dir, "raw.xlsx")
    proc_path = os.path.join(raw_dir, "processed.xlsx")
    with open(raw_path, "wb") as f:
        f.write(b"RAW_CONTENT_PLACEHOLDER")
    with open(proc_path, "wb") as f:
        f.write(b"PROCESSED_CONTENT_PLACEHOLDER")

    sub = Submission(
        id="dl-test-1", assignment_id="asn-1", org_id="org-1",
        file_path=raw_path, file_name="report.xlsx", status="submitted",
        processed_file_path=proc_path,
    )
    db.add(sub)
    db.commit()

    resp = admin_client.get("/api/admin/submissions/dl-test-1/download")
    assert resp.status_code == 200
    assert resp.content == b"RAW_CONTENT_PLACEHOLDER"

    resp = admin_client.get("/api/admin/submissions/dl-test-1/download?type=processed")
    assert resp.status_code == 200
    assert resp.content == b"PROCESSED_CONTENT_PLACEHOLDER"


def test_download_submission_processed_missing(admin_client, db):
    """404 when type=processed but no processed file exists."""
    import os, tempfile
    from app.models.submission import Submission

    raw_dir = tempfile.mkdtemp()
    raw_path = os.path.join(raw_dir, "raw.xlsx")
    with open(raw_path, "wb") as f:
        f.write(b"RAW_CONTENT")

    sub = Submission(
        id="dl-test-2", assignment_id="asn-1", org_id="org-1",
        file_path=raw_path, file_name="report.xlsx", status="submitted",
    )
    db.add(sub)
    db.commit()

    resp = admin_client.get("/api/admin/submissions/dl-test-2/download?type=processed")
    assert resp.status_code == 404
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd backend && python -m pytest tests/integration/test_admin_coverage.py::test_download_submission_processed -v
```

- [ ] **Step 3: Implement type query param**

Replace `download_submission` in `backend/app/api/routes/submissions.py:31-46`:

```python
@router.get("/{submission_id}/download")
def download_submission(
    submission_id: str,
    type: str = "raw",
    db: Session = Depends(get_db),
):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    if type == "processed":
        if not sub.processed_file_path:
            raise HTTPException(status_code=404, detail="No processed file available")
        path = Path(sub.processed_file_path)
    else:
        path = Path(sub.file_path)

    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=str(path),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=sub.file_name,
    )
```

- [ ] **Step 4: Add submission detail endpoint**

```python
@router.get("/{submission_id}")
def get_submission(
    submission_id: str,
    db: Session = Depends(get_db),
):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    return {
        "id": sub.id,
        "file_name": sub.file_name,
        "status": sub.status,
        "has_processed": sub.processed_file_path is not None,
        "review_status": sub.review_status,
        "review_comment": sub.review_comment,
        "reviewed_at": sub.reviewed_at.isoformat() if sub.reviewed_at else None,
    }
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd backend && python -m pytest tests/integration/test_admin_coverage.py -k "download_submission" -v
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/routes/submissions.py backend/tests/integration/test_admin_coverage.py
git commit -m "feat: download endpoint supports raw/processed toggle + submission detail"
```

---

## Chunk 3: Dual View — Frontend

### Task 3: Raw/Calculated tabs in SubmissionReviewView (raw read-only, calculated editable)

**Data model:**
- **Raw** = immutable DevCo submission. Read-only in the UI. This is what the DevCo actually submitted — never modified by PIF admin.
- **Calculated** = admin's working copy. Initialized from raw + formulas on first submit. Editable by admin. Saves go to `processed_file_path`.
- **Recalculate** button re-derives calculated from raw + formulas, discarding manual admin edits (with confirmation dialog).

**Files:**
- Modify: `frontend/src/views/admin/SubmissionReviewView.vue`

- [ ] **Step 1: Add reactive state**

After existing refs (~line 28):

```typescript
const viewMode = ref<'raw' | 'processed'>('raw')  // starts as raw; switchView forces fetch of processed
const hasProcessed = ref(false)
```

- [ ] **Step 2: Fetch submission metadata on mount**

Replace the existing review-status try/catch (~line 49) with:

```typescript
try {
  const headers = await getAuthHeader()
  const meta = await fetch(`/api/admin/submissions/${submissionId}`, { headers })
  if (meta.ok) {
    const data = await meta.json()
    hasProcessed.value = data.has_processed ?? false
    if (data.review_status) reviewStatus.value = data.review_status
    if (data.review_comment) reviewComment.value = data.review_comment
    currentReview.value = data.review_status ?? ''
    // If processed file exists, load it by default
    if (data.has_processed) await switchView('processed')
  }
} catch { /* non-fatal */ }
```

- [ ] **Step 3: Add switchView function**

```typescript
async function switchView(mode: 'raw' | 'processed') {
  if (mode === viewMode.value) return
  viewMode.value = mode
  try {
    const headers = await getAuthHeader()
    const resp = await fetch(
      `/api/admin/submissions/${submissionId}/download?type=${mode}`,
      { headers },
    )
    if (!resp.ok) throw new Error(`Failed to load ${mode} file`)
    const buffer = await resp.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellStyles: true })
    spreadsheetStore.loadWorkbook(wb, fileName.value, buffer)

    // Raw = read-only (immutable DevCo submission), Calculated = editable
    const hot = spreadsheetStore.hotInstance
    if (hot) {
      hot.updateSettings({ readOnly: mode === 'raw' })
    }
    canSave.value = mode === 'processed'
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : `Failed to load ${mode} file`
    viewMode.value = mode === 'raw' ? 'processed' : 'raw'
  }
}
```

- [ ] **Step 4: Add tab UI + Recalculate button above spreadsheet**

```html
<!-- Dual view tabs (shown when calculated file exists) -->
<div v-if="hasProcessed" class="flex items-center gap-1 px-4 py-2 bg-gray-50 border-b">
  <button
    @click="switchView('raw')"
    :class="[
      'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
      viewMode === 'raw'
        ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
        : 'text-gray-500 hover:text-gray-700'
    ]"
  >
    Raw Data
    <span v-if="viewMode === 'raw'" class="text-xs text-gray-400 ml-1">(read-only)</span>
  </button>
  <button
    @click="switchView('processed')"
    :class="[
      'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
      viewMode === 'processed'
        ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
        : 'text-gray-500 hover:text-gray-700'
    ]"
  >Calculated</button>

  <div class="ml-auto">
    <button
      v-if="viewMode === 'processed'"
      @click="confirmRecalculate"
      class="px-3 py-1.5 text-xs font-medium rounded-md text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
    >Recalculate from Raw</button>
  </div>
</div>

<!-- Bootstrap: no calculated file yet, but formulas may be configured -->
<div v-if="!hasProcessed && hasFormulas" class="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b">
  <span class="text-sm text-blue-700">No calculated view yet.</span>
  <button
    @click="confirmRecalculate"
    class="px-3 py-1.5 text-xs font-medium rounded-md text-blue-700 bg-white border border-blue-200 hover:bg-blue-100 transition-colors"
  >Generate Calculated View</button>
</div>
```

Add `hasFormulas` ref (populated from submission metadata endpoint — backend should include `has_formulas: bool` indicating whether `TemplateFormula` records exist for this template version). After a successful recalculate, set `hasProcessed.value = true` and switch to the calculated tab.

- [ ] **Step 5: Save handler preserves workbook structure (patch, not rebuild)**

The current save path (`hot.getData()` → `aoa_to_sheet`) rebuilds from scratch and destroys formulas/styles/merges. For the calculated view, we must **patch** the existing workbook instead.

**Frontend:** Send only the changed cells (cell diffs) instead of the full grid:

```typescript
// Track changes via Handsontable's afterChange hook:
// IMPORTANT: Filter by `source` to only capture direct user edits.
// Without this filter, programmatic loads and recalculation refreshes
// would enqueue changes that overwrite formula cells with static values.
const pendingChanges = ref<Map<string, {row: number, col: number, value: any}>>(new Map())
const formulaCells = ref<Set<string>>(new Set()) // populated from backend formula metadata

hot.addHook('afterChange', (changes, source) => {
  if (!changes) return
  // Only track direct user edits — ignore programmatic loads ('loadData', 'internal', etc.)
  if (source !== 'edit' && source !== 'CopyPaste.paste' && source !== 'Autofill.fill') return
  for (const [row, col, , newVal] of changes) {
    const cellKey = `${row + 1},${col + 1}` // 1-indexed for openpyxl
    // Block edits to formula-owned cells — these should only change via Recalculate
    if (formulaCells.value.has(cellKey)) continue
    // Coalesce by cell: last edit wins (not append-only)
    pendingChanges.value.set(cellKey, { row: row + 1, col: col + 1, value: newVal })
  }
})

// Track file revision for optimistic concurrency control
const fileRevision = ref<number>(0) // populated from submission metadata or save/recalculate responses

// Save sends cell patches, not full workbook:
async function saveProcessed() {
  const headers = await getAuthHeader()
  const resp = await fetch(`/api/admin/submissions/${submissionId}/file?type=processed`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      changes: Array.from(pendingChanges.value.values()),
      revision: fileRevision.value,
    }),
  })
  if (resp.status === 409) {
    // Stale revision — another admin or recalculate modified the file
    alert('This file was modified by another user. Please reload and re-apply your changes.')
    return
  }
  if (!resp.ok) throw new Error('Save failed')
  const data = await resp.json()
  fileRevision.value = data.revision // track new revision
  pendingChanges.value.clear()
}
```

**Backend:** `PUT /{submission_id}/file?type=processed` receives cell patches and applies them to the existing workbook with openpyxl (preserving all other structure).

**Concurrency control:** Uses optimistic locking via `file_revision` (integer column on Submission, default 0). Frontend sends its known revision; backend rejects stale writes. This prevents two admins (or save + recalculate) from silently clobbering each other.

Add to `Submission` model:
```python
file_revision = Column(Integer, nullable=False, default=0, server_default="0")
```

```python
@router.put("/{submission_id}/file")
def save_submission_file(
    submission_id: str,
    type: str = "raw",
    body: CellPatchRequest = None,  # { changes: [{row, col, value}], revision: int }
    db: Session = Depends(get_db),
):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(404, "Submission not found")

    if type == "processed":
        if not sub.processed_file_path:
            raise HTTPException(400, "No processed file to patch")

        # Optimistic concurrency check
        if body.revision is not None and body.revision != sub.file_revision:
            raise HTTPException(
                409,
                f"Stale revision (yours: {body.revision}, current: {sub.file_revision}). "
                "Reload the file and re-apply your changes."
            )

        # Load existing workbook, apply patches, save back
        wb = openpyxl.load_workbook(sub.processed_file_path)
        ws = wb.active
        for change in body.changes:
            ws.cell(row=change.row, column=change.col, value=change.value)
        wb.save(sub.processed_file_path)

        # Bump revision after successful write
        sub.file_revision += 1
        db.commit()

        return {"status": "saved", "patches_applied": len(body.changes), "revision": sub.file_revision}
    else:
        # Raw save — existing full-replace logic (only used if we ever allow raw edits)
        raise HTTPException(403, "Raw file is read-only")
```

> **Design note:** This preserves formulas, styles, merges, extra sheets, and all workbook metadata. Only the specific cells the admin edited are overwritten. The existing `hot.getData()` → rebuild path is NOT used for processed files. Optimistic locking via `file_revision` prevents stale writes from concurrent admins or save/recalculate races.

- [ ] **Step 6: Implement Recalculate endpoint + frontend handler**

Backend endpoint regenerates processed from raw + formulas:

```python
import tempfile, shutil

@router.post("/{submission_id}/recalculate")
def recalculate_submission(
    submission_id: str,
    db: Session = Depends(get_db),
):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    assignment = db.query(Assignment).filter(Assignment.id == sub.assignment_id).first()
    formulas = db.query(TemplateFormula).filter(
        TemplateFormula.template_version_id == assignment.template_version_id
    ).order_by(TemplateFormula.target_row.asc()).all()

    if not formulas:
        raise HTTPException(status_code=400, detail="No formulas configured for this template")

    with open(sub.file_path, "rb") as f:
        raw_bytes = f.read()

    # Execute formulas — may raise on bad formulas/corrupt file
    processed_bytes = FormulaExecutor.execute(raw_bytes, formulas)

    # Determine target path
    if sub.processed_file_path:
        target_path = sub.processed_file_path
    else:
        raw_path = Path(sub.file_path)
        target_path = str(raw_path.parent / f"{raw_path.stem}_processed{raw_path.suffix}")

    # Atomic write: write to temp file first, then move into place
    # If this fails, DB is untouched and submission stays in last known-good state
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".xlsx", dir=Path(target_path).parent)
    try:
        with os.fdopen(tmp_fd, "wb") as f:
            f.write(processed_bytes)
        shutil.move(tmp_path, target_path)
    except Exception:
        # Clean up temp file on failure, don't commit DB change
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise HTTPException(500, "Failed to write processed file")

    # Only commit DB after file is safely on disk
    if not sub.processed_file_path:
        sub.processed_file_path = target_path
    # Bump revision — invalidates any in-flight save from another admin
    sub.file_revision += 1
    db.commit()

    return {"status": "recalculated", "processed_file_path": sub.processed_file_path, "revision": sub.file_revision}
```

> **Design note:** Atomic write order: (1) execute formulas in memory, (2) write to temp file in same directory, (3) `shutil.move` atomically into place, (4) only then commit DB. If any step fails, the submission stays in its previous state — no orphaned DB references to missing files.

Frontend handler with confirmation:

```typescript
async function confirmRecalculate() {
  if (!confirm('This will regenerate the calculated sheet from the original raw submission + formulas, discarding any manual edits. Continue?')) return

  try {
    const headers = await getAuthHeader()
    const resp = await fetch(`/api/admin/submissions/${submissionId}/recalculate`, {
      method: 'POST', headers,
    })
    if (!resp.ok) throw new Error('Recalculate failed')
    // Reload the processed view
    viewMode.value = 'raw' // force re-fetch
    await switchView('processed')
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Recalculate failed'
  }
}
```

- [ ] **Step 7: Test manually**

1. Log in as super_admin → go to a submission with formulas applied
2. Default view is Calculated (editable)
3. Switch to Raw Data → cells are read-only, save button hidden
4. Switch back to Calculated → cells editable, save works
5. Edit some calculated cells, save → edits persist
6. Click "Recalculate from Raw" → confirmation dialog → calculated view resets to formula output
7. If no processed file, tabs don't appear

- [ ] **Step 8: Commit**

```bash
git add frontend/src/views/admin/SubmissionReviewView.vue backend/app/api/routes/submissions.py
git commit -m "feat: dual view — raw read-only, calculated editable, recalculate button"
```

---

## Chunk 4: AI-Driven Formula Configuration (Template-Level)

### Task 4: AI inspects template layout and generates formulas via conversation

Instead of hard-coding formula presets per template type, the admin triggers an AI conversation that:
1. Reads the template `.xlsx` file and auto-detects structure (sheets, headers, data rows, existing formulas)
2. Presents its findings and asks clarifying questions ("I see headers in row 9, data in rows 10-14. Should I create SUM totals in row 16?")
3. Admin confirms/corrects via chat
4. AI generates `TemplateFormula` records with the correct cell references for that specific layout

This works for Safety, Quality, or any future template — no keyword gating or hard-coded cell refs needed.

**Files:**
- Create: `backend/app/services/template_analyzer.py`
- Modify: `backend/app/api/routes/ai.py` (new AI command type)
- Modify: `backend/app/api/routes/formulas.py` (bulk formula creation endpoint)
- Create: `backend/tests/unit/test_template_analyzer.py`

- [ ] **Step 1: Create template analyzer service**

Create `backend/app/services/template_analyzer.py` — reads an `.xlsx` file and extracts structural metadata for the AI:

```python
"""
Analyze template .xlsx files to extract layout metadata.
Used by the AI formula configuration flow to understand sheet structure
before generating TemplateFormula records.
"""
import io
import openpyxl
from openpyxl.utils import get_column_letter


def analyze_template(file_bytes: bytes) -> dict:
    """Extract structural metadata from an xlsx template.

    Returns dict with:
      - sheets: list of sheet names
      - per sheet: headers (row, columns), data_range, existing_formulas, sample_data
    """
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=False)
    result = {"sheets": []}

    for ws in wb.worksheets:
        sheet_info = {
            "name": ws.title,
            "dimensions": ws.dimensions,
            "max_row": ws.max_row,
            "max_col": ws.max_column,
            "headers": [],
            "existing_formulas": [],
            "sample_data": [],
        }

        # Scan for header rows (rows where most cells are strings)
        for row_idx in range(1, min(ws.max_row + 1, 20)):
            row_cells = []
            for col_idx in range(1, ws.max_column + 1):
                cell = ws.cell(row=row_idx, column=col_idx)
                if cell.value is not None:
                    row_cells.append({
                        "col": get_column_letter(col_idx),
                        "value": str(cell.value)[:100],
                        "is_formula": str(cell.value).startswith("=") if cell.value else False,
                    })
            if row_cells:
                string_count = sum(1 for c in row_cells if not c["is_formula"] and not _is_numeric(c["value"]))
                sheet_info["headers"].append({
                    "row": row_idx,
                    "cells": row_cells,
                    "likely_header": string_count > len(row_cells) * 0.5,
                })

        # Collect existing formulas
        for row in ws.iter_rows(min_row=1, max_row=ws.max_row):
            for cell in row:
                if cell.value and str(cell.value).startswith("="):
                    sheet_info["existing_formulas"].append({
                        "cell": f"{get_column_letter(cell.column)}{cell.row}",
                        "formula": str(cell.value),
                    })

        result["sheets"].append(sheet_info)

    return result


def _is_numeric(val: str) -> bool:
    try:
        float(val)
        return True
    except (ValueError, TypeError):
        return False
```

- [ ] **Step 2: Add AI formula configuration endpoint**

In `backend/app/api/routes/ai.py`, add a new endpoint that starts a formula configuration conversation:

```python
@router.post("/configure-formulas")
async def configure_formulas(
    body: FormulaConfigRequest,  # { template_version_id, messages: list[{role, content}] }
    db: Session = Depends(get_db),
    user = Depends(require_admin),  # Admin-only (super_admin / coe_admin)
):
    """AI-driven formula configuration for a template version.

    Uses client-managed conversation state (same pattern as /api/ai/chat):
    frontend sends the full message history each call, AI responds with next step.
    """
    import io
    from app.services.template_analyzer import analyze_template

    tv = db.query(TemplateVersion).filter(
        TemplateVersion.id == body.template_version_id
    ).first()
    if not tv:
        raise HTTPException(404, "Template version not found")

    # Authorization invariant: `require_admin` restricts to super_admin / coe_admin.
    # These roles are GLOBALLY trusted — they are PIF platform operators, not tenant-scoped.
    # There are no tenant-scoped admins in the current role model (see rbac.py:16-23).
    # DevCo users have role=participant and are rejected by require_admin.
    # Therefore any user passing require_admin is authorized for ALL templates.
    #
    # FUTURE: If tenant-scoped admin roles are introduced, add org_id to Template
    # and enforce ownership here. Track in: Phase 1 multi-tenant roadmap.

    # Read the template file
    with open(tv.file_path, "rb") as f:
        file_bytes = f.read()

    layout = analyze_template(file_bytes)

    system_prompt = f"""You are a KPI formula configuration assistant for the Whitehelmet QHSE platform.

The admin wants to configure calculation formulas for a template. Here is the template structure:

{json.dumps(layout, indent=2)}

Your job:
1. Identify the header row, data rows, and formula/total rows from the layout.
2. Ask the admin to confirm your findings: "I see headers in row X, data in rows Y-Z. Is this correct?"
3. Ask what formulas they want: SUM totals? KPI rate calculations? Weighted scores?
4. For KPI rates, ask about the formula pattern (e.g., "incidents * 200000 / manhours") and which columns.
5. Once confirmed, output a JSON array of formula definitions in this exact format:

```json
[{{
  "name": "formula name",
  "target_column": "F",
  "formula_type": "single_cell",
  "expression": "=SUM(F10:F14)",
  "target_row": 16,
  "target_sheet": "ARD",
  "weight": null,
  "scoring_rules": null
}}]
```

Be concise. Ask one round of questions at most before proposing formulas. The admin can iterate."""

    # Client-managed conversation: frontend sends full message history each call.
    # Inject system prompt + layout as first system message, then append user's messages.
    messages = [
        {"role": "system", "content": system_prompt},
        *body.messages,  # [{role: "user"/"assistant", content: "..."}]
    ]

    # Use existing _ai_post() helper (same as /api/ai/chat)
    data = await _ai_post({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 2048,
        "messages": messages,
    })
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

    return {"response": content, "layout_summary": {
        "sheets": [s["name"] for s in layout["sheets"]],
        "detected_headers": [
            {"sheet": s["name"], "row": h["row"], "cells": len(h["cells"])}
            for s in layout["sheets"] for h in s["headers"] if h["likely_header"]
        ],
    }}
```

- [ ] **Step 3: Add bulk formula save endpoint**

In `backend/app/api/routes/formulas.py`, add an endpoint for saving AI-generated formulas:

```python
@router.post("/bulk-save")
def bulk_save_template_formulas(
    template_version_id: str,
    formulas: list[TemplateFormulaCreate],
    db: Session = Depends(get_db),
    user = Depends(require_admin),  # Admin-only (super_admin / coe_admin)
):
    """Atomically replace all formulas for a template version.

    Idempotent: deletes all existing formulas for this version, then inserts the new set.
    Safe to retry — repeated saves produce identical state.
    """
    # Authorization invariant: same as /configure-formulas.
    # super_admin/coe_admin are globally trusted PIF operators (not tenant-scoped).
    # No tenant-scoped admin exists in current role model — participant is rejected.
    # FUTURE: Add org_id ownership check if tenant-scoped admins are introduced.
    tv = db.query(TemplateVersion).filter(TemplateVersion.id == template_version_id).first()
    if not tv:
        raise HTTPException(404, "Template version not found")

    # Delete all existing formulas for this version (atomic replace)
    db.query(TemplateFormula).filter(
        TemplateFormula.template_version_id == template_version_id
    ).delete()

    # Insert the new formula set
    created = []
    for f in formulas:
        tf = TemplateFormula(
            id=str(uuid.uuid4()),
            template_version_id=template_version_id,
            name=f.name,
            target_column=f.target_column,
            formula_type=f.formula_type,
            expression=f.expression,
            target_row=f.target_row,
            weight=f.weight,
            scoring_rules=f.scoring_rules,
            created_by=user.id,
        )
        db.add(tf)
        created.append(tf.id)
    db.commit()
    return {"replaced": len(created), "ids": created}
```

> **Design note:** This is replace-all semantics, not append. Every save replaces the full formula set for a template version in one transaction. Repeated saves are idempotent — no duplicate accumulation possible.

- [ ] **Step 4: Add "Configure Formulas" button in template version UI**

In the template version detail view, add a button that opens the AI chat panel in formula-configuration mode:

```html
<button
  @click="startFormulaConfig"
  class="px-3 py-1.5 text-sm font-medium rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
>Configure Formulas with AI</button>
```

This opens the existing AI chat panel with a special mode that:
- Calls `/api/ai/configure-formulas` instead of `/api/ai/chat`
- Shows the AI's layout analysis and questions
- When AI outputs a JSON formula array, shows a "Save Formulas" button
- On save, calls `POST /api/formulas/bulk-save` (atomic replace — safe to retry)

- [ ] **Step 5: Write test for template analyzer**

Create `backend/tests/unit/test_template_analyzer.py`:

```python
"""Test template layout analysis."""
import io
import openpyxl
from app.services.template_analyzer import analyze_template


def _make_safety_template() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "ARD"
    # Row 9: headers
    for col, header in [("F", "Manhours"), ("G", "Safe Manhours"), ("H", "Fatalities")]:
        ws[f"{col}9"] = header
    # Rows 10-14: numeric data
    for row in range(10, 15):
        ws[f"F{row}"] = 100000
        ws[f"H{row}"] = row - 10
    # Row 16: SUM formulas
    ws["F16"] = "=SUM(F10:F14)"
    ws["H16"] = "=SUM(H10:H14)"
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_analyze_detects_headers():
    result = analyze_template(_make_safety_template())
    assert len(result["sheets"]) == 1
    ard = result["sheets"][0]
    assert ard["name"] == "ARD"
    header_rows = [h for h in ard["headers"] if h["likely_header"]]
    assert any(h["row"] == 9 for h in header_rows)


def test_analyze_finds_existing_formulas():
    result = analyze_template(_make_safety_template())
    ard = result["sheets"][0]
    formula_cells = [f["cell"] for f in ard["existing_formulas"]]
    assert "F16" in formula_cells
    assert "H16" in formula_cells
```

- [ ] **Step 6: Run tests, commit**

```bash
cd backend && python -m pytest tests/unit/test_template_analyzer.py -v
git add backend/app/services/template_analyzer.py backend/app/api/routes/ai.py backend/app/api/routes/formulas.py backend/tests/unit/test_template_analyzer.py
git commit -m "feat: AI-driven formula config — template analyzer + configure-formulas endpoint"
```

---

## Chunk 5: Formula Presets — Library API + Frontend Panel

### Task 5: Expose preset formulas in API and frontend

**Files:**
- Create: `backend/migrations/versions/m7_seed_formula_presets.py`
- Modify: `backend/app/api/routes/formulas.py`
- Modify: `backend/app/schemas/formula.py`
- Modify: `frontend/src/stores/formulas.ts`
- Modify: `frontend/src/components/formulas/FormulaLibraryPanel.vue`

- [ ] **Step 1: Create migration to seed presets into formulas table**

Create `backend/migrations/versions/m7_seed_formula_presets.py` — insert the 7 Safety KPI formulas as `is_library_item=True` rows in the `formulas` table (human-readable versions with parameter names for the formula library UI):

```python
PRESETS = [
    {"name": "Fatality Rate (FR)", "expression": "fatalities * 200000 / manhours", "params": ["fatalities", "manhours"], "desc": "Weight: 0.20"},
    {"name": "LTIFR", "expression": "lti * 200000 / manhours", "params": ["lti", "manhours"], "desc": "Weight: 0.10"},
    {"name": "TRIR", "expression": "recordable_incidents * 200000 / manhours", "params": ["recordable_incidents", "manhours"], "desc": "Weight: 0.10"},
    {"name": "Near Miss Rate", "expression": "near_misses * 200000 / manhours", "params": ["near_misses", "manhours"], "desc": "Weight: 0.15"},
    {"name": "Safety Observation Rate", "expression": "observations * 200000 / manhours", "params": ["observations", "manhours"], "desc": "Weight: 0.15"},
    {"name": "Leadership Engagement Rate", "expression": "walks * 200000 / manhours", "params": ["walks", "manhours"], "desc": "Weight: 0.15"},
    {"name": "Incentive Programs Rate", "expression": "rewards * 200000 / manhours", "params": ["rewards", "manhours"], "desc": "Weight: 0.15"},
]
```

- [ ] **Step 2: Add GET /api/formulas/library endpoint**

In `backend/app/api/routes/formulas.py`, add **before** `GET /`:

```python
@router.get("/library", response_model=list[FormulaResponse])
def list_library_formulas(db: Session = Depends(get_db)):
    rows = db.query(Formula).filter(Formula.is_library_item == True).order_by(Formula.name).all()
    result = []
    for f in rows:
        d = {c.name: getattr(f, c.name) for c in f.__table__.columns}
        if isinstance(d.get("parameters"), str):
            try:
                d["parameters"] = json.loads(d["parameters"])
            except Exception:
                d["parameters"] = None
        result.append(d)
    return result
```

Add `is_library_item: bool = False` to `FormulaResponse` in `backend/app/schemas/formula.py`.

- [ ] **Step 3: Add fetchLibrary to formulas store**

```typescript
const libraryFormulas = ref<SavedFormula[]>([])

async function fetchLibrary() {
  const data = await api.get<SavedFormula[]>('/api/formulas/library')
  libraryFormulas.value = data
}
```

- [ ] **Step 4: Add presets section to FormulaLibraryPanel.vue**

```html
<div class="border-b pb-3 mb-3">
  <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
    Safety KPI Presets
  </h4>
  <div v-if="libraryFormulas.length === 0" class="text-sm text-gray-400 italic">No presets available</div>
  <div v-for="f in libraryFormulas" :key="f.id"
    class="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 group">
    <div class="min-w-0">
      <div class="text-sm font-medium text-gray-800 truncate">{{ f.name }}</div>
      <div class="text-xs text-gray-400 truncate">{{ f.expression }}</div>
    </div>
    <button @click="$emit('apply-preset', f)"
      class="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 opacity-0 group-hover:opacity-100 transition-opacity">
      Use
    </button>
  </div>
</div>
```

- [ ] **Step 5: Run migration, test, commit**

```bash
cd backend && alembic upgrade head
cd backend && python -m pytest tests/ -v
git add backend/migrations/versions/m7_seed_formula_presets.py backend/app/api/routes/formulas.py backend/app/schemas/formula.py frontend/src/stores/formulas.ts frontend/src/components/formulas/FormulaLibraryPanel.vue
git commit -m "feat: Safety KPI formula presets — seed, library API, frontend panel"
```

---

## Chunk 6: Verify Fill-Online (Feature 1)

### Task 6: End-to-end verification of fill-online submit

Implemented in the Artem merge. Verify it works.

- [ ] **Step 1:** Start backend (`uvicorn app.main:app --reload`) and frontend (`npm run dev`)
- [ ] **Step 2:** Log in as focal participant (e.g., `orga.admin@whitehelmet.dev`)
- [ ] **Step 3:** Go to `/submissions`, verify assignment cards appear
- [ ] **Step 4:** Click "Fill Online" → verify template loads, cells are editable, Submit button visible
- [ ] **Step 5:** Fill test data, submit → verify success, redirect, submission in history
- [ ] **Step 6:** Log in as admin, review submission → verify data visible + Raw/Calculated tabs
- [ ] **Step 7:** Document any bugs as follow-up tasks

---

## Chunk 7: Submission Comments (Admin ↔ DevCo)

### Task 7: Admin comments on submissions, DevCo sees them (read-only submission)

After a DevCo submits, the admin can leave comments on the submission. The DevCo can see the comments but **cannot edit the submission** — the raw file remains locked.

**Files:**
- Create: `backend/app/models/submission_comment.py`
- Modify: `backend/app/api/routes/submissions.py` (add comment endpoints)
- Modify: `backend/app/api/routes/subcontractor.py` (DevCo sees comments)
- Modify: `frontend/src/views/admin/SubmissionReviewView.vue` (admin comment UI)
- Modify: `frontend/src/views/subcontractor/SubcontractorSubmissionsView.vue` (DevCo sees comments)

- [ ] **Step 1: Create SubmissionComment model**

```python
class SubmissionComment(Base):
    __tablename__ = "submission_comments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    submission_id = Column(String(36), ForeignKey("submissions.id"), nullable=False, index=True)
    author_id = Column(String(36), nullable=False)  # No FK — identity lives in Keycloak/profiles, not a local table
    author_name = Column(String(255), nullable=False)  # Denormalized for display (avoids cross-schema joins)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
```

> **Design note:** `author_id` stores the user's Keycloak `sub` claim (same as `profiles.id`). No FK constraint because the `users` table has been dropped and identity is managed externally. `author_name` is denormalized at write time to avoid needing joins against external auth.

- [ ] **Step 2: Create Alembic migration**

```bash
cd backend && alembic revision --autogenerate -m "add submission_comments table"
cd backend && alembic upgrade head
```

- [ ] **Step 3: Add comment endpoints (admin)**

```python
@router.get("/{submission_id}/comments")
def list_comments(submission_id: str, db: Session = Depends(get_db)):
    comments = db.query(SubmissionComment).filter(
        SubmissionComment.submission_id == submission_id
    ).order_by(SubmissionComment.created_at.asc()).all()
    return [{"id": c.id, "author_name": c.author_name, "content": c.content,
             "created_at": c.created_at.isoformat()} for c in comments]

@router.post("/{submission_id}/comments")
def add_comment(
    submission_id: str,
    body: CommentCreate,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(404, "Submission not found")
    comment = SubmissionComment(
        submission_id=submission_id,
        author_id=user.id,
        author_name=user.display_name or user.email,
        content=body.content,
    )
    db.add(comment)
    db.commit()
    return {"id": comment.id, "created_at": comment.created_at.isoformat()}
```

- [ ] **Step 4: Expose comments to DevCo (read-only)**

In subcontractor routes, add a GET endpoint for DevCo to see comments on their submissions. DevCo cannot POST comments (one-way communication from admin).

```python
@router.get("/submissions/{submission_id}/comments")
def devco_list_comments(submission_id: str, db: Session = Depends(get_db), user = Depends(get_current_user)):
    # Verify DevCo owns this submission
    sub = db.query(Submission).filter(
        Submission.id == submission_id,
        Submission.org_id == user.org_id,
    ).first()
    if not sub:
        raise HTTPException(404, "Submission not found")
    comments = db.query(SubmissionComment).filter(
        SubmissionComment.submission_id == submission_id
    ).order_by(SubmissionComment.created_at.asc()).all()
    return [{"id": c.id, "author_name": c.author_name, "content": c.content,
             "created_at": c.created_at.isoformat()} for c in comments]
```

- [ ] **Step 5: Admin comment UI in SubmissionReviewView**

Add a comment section below the spreadsheet:

```html
<div class="border-t mt-4 pt-4">
  <h3 class="text-sm font-semibold mb-2">Comments</h3>
  <div v-for="c in comments" :key="c.id" class="mb-2 text-sm">
    <span class="font-medium">{{ c.author_name }}</span>
    <span class="text-gray-400 text-xs ml-2">{{ formatDate(c.created_at) }}</span>
    <p class="text-gray-700">{{ c.content }}</p>
  </div>
  <div class="flex gap-2 mt-2">
    <input v-model="newComment" placeholder="Add a comment..." class="flex-1 border rounded px-3 py-1.5 text-sm" />
    <button @click="postComment" :disabled="!newComment.trim()" class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded">Send</button>
  </div>
</div>
```

- [ ] **Step 6: DevCo comment display in submissions view**

Show comments on the DevCo submission detail/history view. No input field — read-only. Show a badge/indicator if there are unread comments.

- [ ] **Step 7: Test + commit**

```bash
cd backend && python -m pytest tests/ -v
git add backend/app/models/submission_comment.py backend/app/api/routes/submissions.py backend/app/api/routes/subcontractor.py backend/migrations/versions/ frontend/src/views/admin/SubmissionReviewView.vue frontend/src/views/subcontractor/SubcontractorSubmissionsView.vue
git commit -m "feat: submission comments — admin posts, DevCo views (read-only)"
```

---

## Unresolved Questions

1. The `target_column` field has a collision for row-16 SUMs vs row-17 KPI rates (both use H, I, etc. but different rows). FormulaExecutor handles this via `target_row`, but need to verify xlcalculator can evaluate formulas that reference cells written by earlier formulas in the same batch (e.g., `=H16*200000/F16` depends on `=SUM(H10:H14)` being in H16 first). The new end-to-end test (`test_absolute_ref_kpi_formula_end_to_end`) will catch this if it fails.
2. ~~Quality KPI template has a different column layout~~ — **Resolved by AI-driven config.** AI analyzes any template layout dynamically, no per-type formula sets needed.
3. ~~Should the "Apply Safety KPI Formulas" checkbox default to checked or unchecked?~~ **Resolved: replaced with AI-driven formula config.** No checkbox — admin triggers AI conversation to configure formulas for any template.
4. ~~Should DevCo be able to reply to admin comments?~~ **Resolved: strictly one-way (admin → DevCo).** DevCo sees comments on login, no reply capability.
5. ~~Should admin comments trigger a notification/email?~~ **Resolved: no.** DevCo sees comments when they log in and view their submissions.

## Resolved Review Findings

### Round 1 (Codex adversarial review, 2026-05-10)

1. **[high] Dual source of truth** — Raw is now **read-only** (immutable DevCo submission). Calculated is the admin's editable working copy. "Recalculate from Raw" button re-derives calculated from raw + formulas with confirmation dialog. Only one file is ever written to — no divergence.
2. **[high] Safety formulas default-on for all templates** — Replaced entirely with AI-driven formula configuration. AI inspects the actual template `.xlsx`, auto-detects layout, asks admin to confirm, then generates `TemplateFormula` records. No hard-coded cell refs or keyword gating.
3. **[medium] KPI test didn't assert calculated values** — Replaced placeholder test with `test_absolute_ref_kpi_formula_end_to_end` that seeds all row-16 SUM formulas, evaluates row-17 KPI rates, and asserts exact numeric results.

### Round 2 (Codex adversarial review, 2026-05-10)

4. **[high] Formula config endpoints lacked authorization** — Both `/api/ai/configure-formulas` and `/api/formulas/bulk-save` now require `require_admin` dependency. Template model currently has no `org_id` — role gate (super_admin/coe_admin) is sufficient. NOTE comments added for future multi-tenant org_id check.
5. **[high] Non-idempotent formula saves** — Renamed to `bulk-save` with replace-all semantics: deletes all existing `TemplateFormula` rows for the template version, then inserts the new set in one transaction. Repeated saves produce identical state. No duplicate accumulation.
6. **[high] Comments FK references dropped `users` table** — `author_id` is now stored without FK constraint. Identity lives in Keycloak (external). `author_name` denormalized at write time to avoid cross-schema joins.
7. **[medium] No bootstrap for missing `processed_file_path`** — Recalculate endpoint now allocates a deterministic path (`<raw_stem>_processed.xlsx`) when `processed_file_path` is NULL, persists it to DB, then generates the file. Frontend shows a "Generate Calculated View" button for submissions without a processed file (when formulas are configured).

### Round 3 (Codex adversarial review, 2026-05-10)

8. **[high] Template tenancy check used nonexistent `org_id`** — Fixed: `Template` model has no `org_id`. Authorization is role-based (`require_admin` = super_admin/coe_admin only). Removed the false `template.org_id` check. Added NOTE comments for future multi-tenant addition.
9. **[high] `target_row` not in schemas** — Added explicit Step 2 in Chunk 1: `target_row: int | None = None` added to `TemplateFormulaCreate`, `TemplateFormulaUpdate`, and `TemplateFormulaResponse`. Round-trips through all CRUD endpoints and AI bulk-save flow.
10. **[high] AI endpoint used nonexistent `call_ai`, no conversation state** — Replaced with existing `_ai_post()` helper. Conversation is client-managed (same as `/api/ai/chat`): frontend sends full `messages` array each call. Added `FormulaConfigRequest` body schema with `template_version_id` + `messages`. Fixed missing `import io` in template_analyzer.

### Round 4 (Codex adversarial review, 2026-05-10)

11. **[high] Save flow destroys workbook structure** — Replaced full-workbook rebuild (`hot.getData()` → `aoa_to_sheet`) with cell-patch approach. Frontend tracks individual cell changes via `afterChange` hook and sends only diffs. Backend applies patches to existing workbook with openpyxl, preserving formulas/styles/merges/sheets.
12. **[high] `processed_file_path` committed before file exists** — Recalculate is now atomic: (1) execute formulas in memory, (2) write to temp file, (3) `shutil.move` atomically into place, (4) only then commit DB. If any step fails, submission stays in previous state.
13. **[high] Default-to-processed never loads processed file** — `viewMode` now initializes to `'raw'`. `switchView('processed')` is called from metadata fetch, which triggers actual file load since mode differs. No short-circuit on first load.
14. **[high] AI formula-config skips tenant checks** — Added explicit authorization invariant documentation: `super_admin`/`coe_admin` are globally trusted PIF platform operators (not tenant-scoped). `participant` role (DevCo) is rejected by `require_admin`. No tenant-scoped admin exists in the current role model. Future note added for when/if tenant-scoped admins are introduced.
