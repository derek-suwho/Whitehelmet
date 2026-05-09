# Submission Locking + Formula Auto-Application Design

## Scope

This spec covers Phase B of the remaining production work. Phases A and C are noted below for future reference.

**Phase A (future — needs Keycloak credentials):** Keycloak JWT auth middleware (3-step validation), frontend token flow (strip `?token=`, bearer header, refresh logic), RabbitMQ shadow table consumer.

**Phase C (future — no external deps):** Audit log (append-only mutation trail), multi-tenant org scoping (`org_id` enforcement on all routes).

---

## Phase B: What This Spec Covers

Two independent subsystems:
1. **Submission Locking** — PIF admin freezes a DevCo submission; no further uploads accepted
2. **Formula Auto-Application** — Excel-style formulas attached to template versions, evaluated server-side on submission, results written back into xlsx

---

## Part 1: Submission Locking

### What it does
Sets `assignment.status = "locked"`, stamps `locked_at` + `locked_by`. Blocks further file uploads from the DevCo. No other side effects — does not trigger formulas or consolidation.

### DB change
Add two columns to `template_assignments`:
- `locked_at` — DateTime, nullable
- `locked_by` — String(36), nullable (user ID)

### API
- `POST /api/admin/assignments/{id}/lock` — requires `pif_admin` role
- `POST /api/admin/assignments/{id}/unlock` — reverts status to `submitted`, clears `locked_at`/`locked_by`

### Existing behavior preserved
`subcontractor.py` already rejects submissions when `assignment.status == "locked"` (409 response). No change needed there.

---

## Part 2: Formula Auto-Application

### How formulas work
PIF defines formulas per template version. Two types:
- **Column formula** — applied row-by-row to each data row in the submission. Expression uses `{row}` placeholder: `=O{row}/N{row}` → expands to `=O2/N2`, `=O3/N3`, etc.
- **Single-cell formula** — one result for the whole sheet. Full Excel syntax: `=SUM(A2:A100)`.

Results are written as numeric values into the xlsx (not formula strings), so the consolidation engine can read them directly. Original submission file is preserved; processed file is stored separately.

### New model — `TemplateFormula`

| Field | Type | Notes |
|-------|------|-------|
| `id` | String(36) PK | UUID |
| `template_version_id` | String(36) | FK → template_versions.id |
| `name` | String(255) | Human label e.g. "TRIR Score" |
| `target_column` | String(10) | Column letter result is written to e.g. "E" |
| `formula_type` | String(20) | `column` or `single_cell` |
| `expression` | String(500) | Excel formula with `{row}` for column type |
| `weight` | Float nullable | For weighted score total |
| `benchmark` | Float nullable | Minimum benchmark threshold |
| `scoring_rules` | Text (JSON) nullable | `[{"min": 0, "max": 0.01, "score": 90}, ...]` |
| `created_by` | String(36) nullable | |
| `created_at` | DateTime | |

### FormulaExecutor service (`app/services/formula_executor.py`)

Input: xlsx bytes + list of `TemplateFormula` rows
Output: modified xlsx bytes with numeric results written in

Steps:
1. Load workbook with openpyxl
2. Detect data range: first row after header → last populated row
3. For each `column` formula: expand `{row}` for each data row, write formula string to target column cells
4. For each `single_cell` formula: write formula string to target cell
5. Load modified workbook into `xlcalculator`, evaluate all formulas
6. Read computed numeric values, write them back into cells (replace formula strings with numbers)
7. If `scoring_rules` present: map each computed value to a score, write score to adjacent cell
8. If any formula has `weight`: compute weighted score total, write to summary cell
9. Return modified xlsx bytes as `io.BytesIO`

### Submission wiring (`app/api/routes/subcontractor.py`)

After saving the submitted file:
1. Query `template_formulas` for the assignment's `template_version_id`
2. If formulas exist: run `FormulaExecutor` → save processed bytes to `uploads/submissions/{org_id}/{submission_id}_processed.xlsx` → store path in `submission.processed_file_path`
3. If no formulas: skip

### DB change to `Submission`
Add `processed_file_path` — String(500), nullable.

### Consolidation fallback
When reading submission files for consolidation, prefer `processed_file_path` if set, fall back to `file_path`.

### Admin CRUD API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/template-versions/{id}/formulas` | List formulas for a version |
| POST | `/api/admin/template-versions/{id}/formulas` | Create formula |
| PUT | `/api/admin/formulas/{formula_id}` | Update formula |
| DELETE | `/api/admin/formulas/{formula_id}` | Delete formula |

All require `pif_admin` role.

### New dependency
`xlcalculator` — added to `requirements.txt`.

---

## File Map

| File | Action |
|------|--------|
| `backend/app/models/template_assignment.py` | Add `locked_at`, `locked_by` |
| `backend/app/models/submission.py` | Add `processed_file_path` |
| `backend/app/models/template_formula.py` | New model |
| `backend/app/models/__init__.py` | Export `TemplateFormula` |
| `backend/app/schemas/formulas.py` | New Pydantic schemas |
| `backend/app/services/formula_executor.py` | New executor service |
| `backend/app/api/routes/admin.py` | Add lock/unlock endpoints + formula CRUD |
| `backend/app/api/routes/subcontractor.py` | Wire executor on submit |
| `backend/migrations/versions/XXXX_submission_locking_formula_engine.py` | New migration |
| `backend/requirements.txt` | Add `xlcalculator` |
| `backend/tests/unit/test_formula_executor.py` | Unit tests for executor |
| `backend/tests/integration/test_locking.py` | Integration tests for lock/unlock |
