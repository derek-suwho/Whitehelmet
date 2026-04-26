# Formula & AI Spreadsheet Integration — Design Spec
Date: 2026-04-25

## Problem Summary

Four bugs/gaps to fix:

1. **AI operations are completely broken.** `useAiOperations.ts` calls jspreadsheet APIs (`setValueFromCoords`, `getConfig`, `insertColumn`, `setHeader`, `setStyle`, `orderBy`, etc.) but the editor was rewritten to use Handsontable. Every spreadsheet mutation silently fails or throws.
2. **Formula Apply UX is poor.** The Apply button asks for a free-text column name. It should show a dropdown of actual column headers from the open spreadsheet.
3. **Formulas in exported Excel must evaluate.** Formula strings written to cells must be serialized as XLSX formula objects (not plain strings) so Excel evaluates them on open.
4. **Formulas must be tied to the logged-in user.** Already implemented in the backend (`user_id` FK on `formulas` table, auth-gated routes) — no backend changes needed.

---

## Architecture

No new files. Three existing files change:

| File | Change |
|---|---|
| `frontend/src/composables/useAiOperations.ts` | Rewrite all spreadsheet helper functions and `applyOperation` cases for Handsontable API |
| `frontend/src/composables/useSpreadsheetEditor.ts` | Export `applyFmtExternal(row, col, props)` for external formatting writes |
| `frontend/src/components/formulas/FormulaLibraryPanel.vue` | Replace text input with column header dropdown |

---

## Section 1 — Fix AI Operations

### Data layout

Handsontable stores everything in a flat data array where **row 0 is the header row**. The spreadsheet store exposes this instance via `spreadsheet.instance`.

```
getData()[0]        → header row  (Excel row 1)
getData()[1]        → first data row (Excel row 2)
getData()[d+1]      → data row d (0-based) (Excel row d+2)
```

### Helper function rewrites

```ts
getColumnHeaders(hot) → hot.getData()[0].map(String)
getDataRows(hot)      → hot.getData().slice(1)
getRowCount(hot)      → hot.countRows() - 1       // excludes header row
getColCount(hot)      → hot.countCols()
```

### {row} placeholder

The AI generates formulas with `{row}` as the Excel row placeholder (e.g. `=A{row}*B{row}`). For data row `d` (0-based):
- Handsontable row = `d + 1`
- Excel row = `d + 2` (header occupies Excel row 1)

**Replace `{row}` with `d + 2`**, not `d + 1` as the old (broken) code did.

### Operation rewrites

| Operation | Old (jspreadsheet) | New (Handsontable) |
|---|---|---|
| Write cell | `jss.setValueFromCoords(col, row, val)` | `jss.setDataAtCell(row, col, val)` |
| Bulk write | loop setValueFromCoords | `jss.setDataAtCell([[r,c,v], ...])` |
| Set header | `jss.setHeader(idx, title)` | `jss.setDataAtCell(0, idx, title)` |
| Insert column | `jss.insertColumn(1, pos, true)` | `jss.alter('insert_col_start', pos, 1)` |
| Delete column | `jss.deleteColumn(idx, 1)` | `jss.alter('remove_col', idx, 1)` |
| Insert row | `jss.insertRow(count, pos)` | `jss.alter('insert_row_below', pos, count)` |
| Delete row | `jss.deleteRow(row, 1)` | `jss.alter('remove_row', row, 1)` |
| Sort | `jss.orderBy(idx, order)` | `jss.getPlugin('columnSorting').sort({column, sortOrder})` |
| Load data | `jss.loadData(aoa)` | `jss.loadData(aoa)` (unchanged) |
| Filter rows | DOM `tr.style.display = 'none'` | `jss.getPlugin('hiddenRows').hideRows([...])` + `jss.render()` |
| Show all rows | DOM restore | `jss.getPlugin('hiddenRows').showRows([...])` + `jss.render()` |
| Style cells | `jss.setStyle(styleMap)` | `applyFmtExternal(row, col, props)` (see Section 2) |

### Consolidation/report helpers

`executeConsolidateToTemplate` and `executeDynamicReport` call `jss.setValueFromCoords(i, 0, header)` to write headers. Change to `jss.setDataAtCell(0, i, header)`.

### Export operation

The AI `export` op currently manually builds a workbook without formula conversion. Fix: use `jss.getData()` (includes header at row 0) and inline the formula string → XLSX cell object conversion (same logic as `downloadXlsx`).

---

## Section 2 — Formatting Support

### Problem

`_setFmt` and `_allSheetFormats` are private module state inside `useSpreadsheetEditor.ts`. AI formatting operations (`format_cells`, `highlight_column`, `conditional_format`, `clear_format`) need to write to this state.

### Fix

Add one export to `useSpreadsheetEditor.ts`:

```ts
export function applyFmtExternal(row: number, col: number, props: Record<string, any>): void {
  _setFmt(_currentSheetIdx, row, col, props)
  _currentInstance?.render()
}
```

`useAiOperations.ts` imports and calls this instead of `jss.setStyle(styleMap)`.

Row indexing for formatting: the AI sends `p.row` as a 1-based data row number. In Handsontable, data row 1 = Handsontable row 1 (header is at 0). So `hotRow = Number(p.row)` (no -1 needed, unlike the old code which used `-1` for jspreadsheet's 0-based data rows).

---

## Section 3 — Formula Apply UX

### Current behaviour
Modal with a free-text input asking for a column name. Fails silently if the column doesn't exist.

### New behaviour
When Apply is clicked:
1. Read headers from `spreadsheet.instance.getData()[0]` — filter out empty strings
2. If no spreadsheet is open → show "Open a spreadsheet first" message and bail
3. Show modal with a `<select>` dropdown populated with those headers, first header pre-selected
4. User selects column, clicks Apply
5. Iterate data rows `d = 0` to `countRows()-2`: call `hot.setDataAtCell([[d+1, idx, expr], ...])` with `{row}` replaced by `d+2`

### Formula export correctness

`downloadXlsx` in `useSpreadsheetEditor.ts` already converts formula strings (values starting with `=`) to XLSX formula cell objects using SheetJS:
```ts
cell.f = cell.v.slice(1)   // strip leading =
cell.t = 'n'
delete cell.v
```
This runs on `getSourceData()` which returns the raw formula strings HyperFormula stored. No change needed here — once formulas are correctly written via `setDataAtCell`, export will work.

---

## What is NOT changing

- Backend formula routes — already correct (`user_id` scoping, auth-gated)
- `downloadXlsx` — already handles formula export
- `useSpreadsheetEditor.ts` Handsontable setup — no changes to config or rendering
- Chat streaming, consolidation AI logic, source file parsing — untouched

---

## Prerequisites

The AI features require `OPENROUTER_API_KEY` to be set in `backend/.env`. Without it the backend returns 503 on all `/api/ai/*` calls.
