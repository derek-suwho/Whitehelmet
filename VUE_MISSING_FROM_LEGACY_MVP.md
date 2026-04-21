# Vue Implementation Gaps vs Legacy MVP

This file lists functionality that exists in the legacy MVP (`index.html`, `js/`, `css/`) but is not available in the current Vue implementation under `frontend/src` as it is currently wired.

Scope note:
- This compares the shipped Vue app, not dormant helper code that is present but unused.
- In particular, `frontend/src/components/editor/SpreadsheetEditor.vue` currently mounts a minimal editor flow and does not wire in the richer spreadsheet behavior implemented in `frontend/src/composables/useSpreadsheetEditor.ts`.

## Spreadsheet Editor

### 1. Multi-sheet workbook support
- Legacy MVP opens all workbook sheets, renders sheet tabs, and lets the user switch between them.
- Current Vue editor only opens the first sheet of a workbook.

Legacy evidence:
- `js/excel-editor.js`
  - builds `sheetNames`
  - renders `_buildSheetTabs()`
  - switches `currentInstance.loadData(sheetsData[idx])`

Vue status:
- `frontend/src/components/editor/SpreadsheetEditor.vue`
  - reads `const sheetName = wb.SheetNames[0]`
  - does not render sheet tabs

### 2. Workbook formatting preservation
- Legacy MVP preserves imported cell formatting, including:
  - bold / italic / underline
  - text color / fill color
  - alignment
  - wrap text
  - number/date formatting
- Current Vue editor loads cell values only in the active path and does not preserve those imported styles in the rendered UI.

Legacy evidence:
- `js/excel-editor.js`
  - reads `cell.s`
  - stores per-cell formatting in `_allSheetFormats`
  - renders with custom `fmtRenderer`

Vue status:
- `frontend/src/components/editor/SpreadsheetEditor.vue`
  - converts the sheet to arrays and mounts a simple grid
  - does not apply imported workbook styles

### 3. Merged cells and column width preservation
- Legacy MVP preserves merged ranges and column widths from the source workbook.
- Current Vue editor does not expose that behavior in the mounted component.

Legacy evidence:
- `js/excel-editor.js`
  - reads `ws['!merges']`
  - reads `ws['!cols']`
  - passes `mergeCells` and `colWidths` into Handsontable

Vue status:
- `frontend/src/components/editor/SpreadsheetEditor.vue`
  - mounts a flat `jspreadsheet` instance with fixed width columns
  - no merge preservation path is wired

### 4. Rich spreadsheet toolbar
- Legacy MVP includes an editor toolbar for:
  - undo / redo
  - bold / italic / underline
  - text color / fill color
  - left / center / right alignment
  - merge cells
  - wrap text
  - number format selection
  - insert row / insert column
  - delete row
  - freeze first row
  - find & replace
  - zoom in / out / reset
- Current Vue editor only shows file-level actions: download and close.

Legacy evidence:
- `js/excel-editor.js`
  - `_buildToolbar()`
  - `_wireToolbar()`

Vue status:
- `frontend/src/components/editor/SpreadsheetEditor.vue`
  - toolbar only contains `Download` and `Close`

### 5. Formula bar and cell reference display
- Legacy MVP has a formula bar with current cell reference and editable formula/value input.
- Current Vue editor does not expose a formula bar.

Legacy evidence:
- `js/excel-editor.js`
  - `_buildFormulaBar()`
  - `_updateFormulaBar()`

Vue status:
- no formula bar is rendered in `frontend/src/components/editor/SpreadsheetEditor.vue`

### 6. Find and replace UI
- Legacy MVP has a find-and-replace modal.
- Current Vue editor does not expose find/replace.

Legacy evidence:
- `js/excel-editor.js`
  - `_showFindModal()`

Vue status:
- no corresponding UI is mounted in the Vue editor

### 7. Zoom controls and pinch-to-zoom
- Legacy MVP includes explicit zoom buttons and trackpad pinch zoom scoped to the spreadsheet area.
- Current Vue editor does not expose zoom controls.

Legacy evidence:
- `js/excel-editor.js`
  - zoom buttons in `_buildToolbar()`
  - wheel listener for ctrl/pinch zoom

Vue status:
- no zoom controls in `frontend/src/components/editor/SpreadsheetEditor.vue`

### 8. Formula engine integration
- Legacy MVP wires HyperFormula when available.
- Current Vue editor does not expose equivalent formula-engine integration in its active editor path.

Legacy evidence:
- `js/excel-editor.js`
  - `htConfig.formulas = { engine: HyperFormula }`

Vue status:
- the active component path in `frontend/src/components/editor/SpreadsheetEditor.vue` does not wire a formula engine

### 9. Multi-sheet export fidelity
- Legacy MVP exports all loaded sheets back into the workbook.
- Current Vue editor exports a single synthetic `Sheet1` when exporting from the active instance.

Legacy evidence:
- `js/excel-editor.js`
  - loops through `sheetsData` and `sheetNames`

Vue status:
- `frontend/src/components/editor/SpreadsheetEditor.vue`
  - builds a new workbook with one sheet only

## AI / Spreadsheet Operations

### 10. Template suggestion workflow
- Legacy MVP supports AI-driven "suggest template" behavior.
- Current Vue implementation does not expose that operation in the active AI workflow.

Legacy evidence:
- `js/ai-operations.js`
  - `suggest_template`

Vue status:
- no equivalent user-visible command flow is wired in the current Vue chat/editor path

### 11. Consolidate selected sources into an existing template
- Legacy MVP supports `consolidate_to_template`, including source-layout detection and source-to-template mapping.
- Current Vue implementation does not expose this workflow.

Legacy evidence:
- `js/ai-operations.js`
  - `executeConsolidateToTemplate()`
  - dispatch case `consolidate_to_template`

Vue status:
- current Vue consolidation always builds a consolidated result, not a "fill this template from selected sources" workflow

### 12. Dynamic AI-generated report building
- Legacy MVP supports `dynamic_report`, where the AI proposes report columns and then populates them from selected sources.
- Current Vue implementation does not expose that workflow.

Legacy evidence:
- `js/ai-operations.js`
  - `executeDynamicReport()`
  - dispatch case `dynamic_report`

Vue status:
- no equivalent user-visible report-generation workflow is wired

## Records / Dashboard

### 13. Save prompt after consolidation
- Legacy MVP shows a save bar after consolidation asking whether the user wants to save the result to records.
- Current Vue implementation does not show an equivalent prompt.

Legacy evidence:
- `js/master-records.js`
  - `showSaveBar()`
  - `showSaveModal()`

Vue status:
- no post-consolidation save prompt in the current Vue flow

### 14. Save-to-records modal with naming flow
- Legacy MVP includes a dedicated modal to name and save the consolidation result.
- Current Vue implementation does not expose that modal flow.

Legacy evidence:
- `js/master-records.js`
  - `showSaveModal()`

Vue status:
- no equivalent modal is wired in the Vue workspace

### 15. Re-open saved records from the dashboard
- Legacy MVP dashboard has an `Open` action that attempts to reopen a saved record in the spreadsheet editor.
- Current Vue dashboard only lists and deletes records.

Legacy evidence:
- `js/master-records.js`
  - `buildRow()`
  - `openRecord()`
  - `state.openFile(record.fileObj)`

Vue status:
- `frontend/src/views/DashboardView.vue`
  - only exposes delete
  - no open/reload action

### 16. Search and sort in the records dashboard
- Legacy MVP dashboard supports:
  - sorting by name / date
  - searching records
  - richer table-state views
- Current Vue dashboard is a simple card grid without search or sort controls.

Legacy evidence:
- `js/master-records.js`
  - `sortRecords()`
  - sortable header rendering
  - search-result rendering

Vue status:
- `frontend/src/views/DashboardView.vue`
  - static card grid only

### 17. Table-style records dashboard
- Legacy MVP renders records in a denser table with stats and explicit actions.
- Current Vue implementation uses a simpler card layout and omits some management affordances present in the MVP.

Legacy evidence:
- `js/master-records.js`
  - table header / rows / loading / empty / error states

Vue status:
- `frontend/src/views/DashboardView.vue`
  - card-only layout

## File Ingestion

### 18. Duplicate file guarding
- Legacy MVP prevents duplicate top-level file additions and duplicate folder-name additions.
- Current Vue sources store appends files and folders without equivalent dedupe rules.

Legacy evidence:
- `js/file-ingestion.js`
  - duplicate checks in `addFiles()`
  - folder-name duplicate check in `addFolder()`

Vue status:
- `frontend/src/stores/sources.ts`
  - `addFiles()` and folder-add flows do not dedupe

## Important Context

Some of the missing spreadsheet behavior appears to have been partially ported into:
- `frontend/src/composables/useSpreadsheetEditor.ts`

That file contains Vue-side implementations for many legacy editor features, including:
- multi-sheet handling
- toolbar state
- formula bar state
- zoom state
- formatting helpers

However, the current mounted component:
- `frontend/src/components/editor/SpreadsheetEditor.vue`

does not use that composable. So those features are not available in the current Vue implementation as shipped.
