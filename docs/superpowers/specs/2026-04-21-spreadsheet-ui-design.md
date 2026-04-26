# Spreadsheet UI Port — Design Spec
Date: 2026-04-21

## Goal
Port the full legacy spreadsheet UI from `js/excel-editor.js` into the Vue 3 production frontend. Faithful port — no additions, no removals.

## Approach
Switch Vue from Jspreadsheet CE to Handsontable CE (same library as legacy). All imperative HT logic moves into a new `useSpreadsheetEditor` composable. `SpreadsheetEditor.vue` becomes a thin Vue template shell.

## Architecture

**New file:** `frontend/src/composables/useSpreadsheetEditor.ts`
- Owns Handsontable lifecycle (init, destroy, sheet switching)
- Owns formatting state (`_allSheetFormats`, `setFmt`, `getFmt`)
- Owns zoom state
- Exposes toolbar action methods called from the Vue template
- Calls `spreadsheet.setInstance()` after HT init so consolidation/AI ops stay compatible

**Modified:** `frontend/src/components/editor/SpreadsheetEditor.vue`
- Jspreadsheet removed
- Toolbar, formula bar, sheet tabs rendered as Vue template
- All actions delegate to `useSpreadsheetEditor`

**Modified:** `frontend/src/stores/spreadsheet.ts`
- `instance` type updated to `Handsontable.Core | null`
- No interface changes

**Modified:** `frontend/package.json`
- Add `handsontable` npm dependency

## Features Ported

| Feature | Source |
|---|---|
| Toolbar (undo/redo, bold/italic/underline, text/fill color, alignment, merge, wrap, number format, insert/delete row, freeze, find, zoom) | `_buildToolbar()` + `_wireToolbar()` |
| Formula bar (cell ref + fx input) | `_buildFormulaBar()` + `_updateFormulaBar()` |
| Sheet tabs | `_buildSheetTabs()` |
| Cell formatting engine + custom renderer | `fmtRenderer`, `setFmt`, `getFmt`, `_allSheetFormats` |
| Cell styles on file open (XLSX parse) | XLSX `cellStyles:true` loop |
| Color picker dropdown | `_showColorPicker()` |
| Find & Replace modal | `_showFindModal()` |
| Zoom (toolbar + pinch-to-zoom) | `_stepZoom()`, `_applyZoom()` |
| Keyboard shortcuts (Ctrl+B/I/U/F) | `_wireKeyboardShortcuts()` |
| Multi-sheet support | `sheetsData[]`, `sheetNames[]`, tab switching |
| Column widths, merge cells, fixed header row | HT config options |

## Error Handling & Cleanup
- Destroy HT instance before creating new one on workbook change
- `onBeforeUnmount`: destroy instance + remove keyboard listener
- Formula bar: Enter commits, Escape reverts
- Color picker / find modal: click-outside overlay dismisses
- Pinch-to-zoom scoped to HT container only (`ctrlKey` + wheel)

## Out of Scope
- No new features beyond legacy parity
- No AI operation changes (store interface unchanged)
- No styling changes to match legacy visual design — Vue Tailwind theme is kept
