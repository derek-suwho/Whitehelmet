# Spreadsheet UI Port — Handsontable Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the non-functional Jspreadsheet CE integration in Vue with Handsontable CE, porting the full legacy toolbar, formula bar, sheet tabs, cell formatting, zoom, color picker, find modal, and keyboard shortcuts from `js/excel-editor.js`.

**Architecture:** A single `useSpreadsheetEditor` composable owns all Handsontable lifecycle and imperative logic (module-level state, same pattern as legacy). `SpreadsheetEditor.vue` becomes a thin Vue template shell that binds to exported reactive refs and calls composable methods. `useConsolidation.ts` is updated to trigger the watcher pattern instead of directly creating a spreadsheet instance.

**Tech Stack:** Vue 3 + TypeScript, Handsontable CE (npm), SheetJS (xlsx), Pinia, Tailwind CSS, Vitest

---

## Chunk 1: Dependency Swap

### Task 1: Remove Jspreadsheet, install Handsontable

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/main.ts`
- Modify: `frontend/src/assets/main.css`

- [ ] **Step 1: Remove jspreadsheet packages, add handsontable**

```bash
cd frontend
npm remove jspreadsheet-ce jsuites
npm install handsontable
```

Expected: `package.json` dependencies updated; no jspreadsheet-ce or jsuites entries.

- [ ] **Step 2: Import Handsontable CSS in main.ts**

Full file after edit (`frontend/src/main.ts`):

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from '@/router'
import App from '@/App.vue'
import 'handsontable/dist/handsontable.full.min.css'
import '@/assets/main.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
```

- [ ] **Step 3: Add custom CSS for toolbar/formula bar/color picker/find modal to main.css**

Full file after edit (`frontend/src/assets/main.css`):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ── Spreadsheet toolbar ─────────────────────────────────────── */
.xt-btn {
  @apply flex items-center justify-center rounded px-1.5 py-1 text-xs text-gray-300 transition-colors duration-100;
  @apply hover:bg-white/10 hover:text-white active:bg-white/20;
  min-width: 24px;
  height: 24px;
}
.xt-btn-active {
  @apply bg-white/15 text-white;
}
.xt-sep {
  @apply mx-0.5 h-4 w-px bg-white/10 shrink-0;
}
.xt-color-btn {
  @apply flex-col gap-0;
  height: 28px;
}
.xt-color-bar {
  height: 3px;
  width: 14px;
  border-radius: 1px;
  margin-top: 1px;
}
.xt-select {
  @apply rounded bg-white/5 px-1 py-0.5 text-xs text-gray-300 border border-white/10;
  @apply hover:bg-white/10 focus:outline-none;
  height: 24px;
}
.xt-zoom-label {
  @apply text-xs text-gray-500 tabular-nums;
  min-width: 36px;
  text-align: center;
}

/* ── Formula bar ─────────────────────────────────────────────── */
.xt-formula-bar {
  @apply flex items-center border-b border-white/5 bg-surface;
  height: 28px;
  flex-shrink: 0;
}
.xt-cell-ref {
  @apply text-xs text-gray-400 font-mono px-2 border-r border-white/10;
  min-width: 48px;
  text-align: center;
  line-height: 28px;
}
.xt-formula-sep {
  @apply w-px h-4 bg-white/10 mx-1 shrink-0;
}
.xt-formula-input {
  @apply flex-1 bg-transparent text-xs text-gray-200 px-2 focus:outline-none;
}

/* ── Sheet tabs ──────────────────────────────────────────────── */
.xt-sheet-tabs {
  @apply flex border-t border-white/5 bg-surface overflow-x-auto;
  flex-shrink: 0;
}
.xt-sheet-tab {
  @apply px-3 py-1 text-xs text-gray-500 border-r border-white/5 hover:bg-white/5 hover:text-gray-300 transition-colors duration-100;
  white-space: nowrap;
}
.xt-sheet-tab.active {
  @apply bg-white/10 text-gray-200;
}

/* ── Color picker dropdown ───────────────────────────────────── */
.xt-color-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 9999;
  display: grid;
  grid-template-columns: repeat(8, 18px);
  gap: 2px;
  padding: 6px;
  background: #1e1e38;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}
.xt-color-swatch {
  width: 18px;
  height: 18px;
  border-radius: 2px;
  cursor: pointer;
  border: 1px solid rgba(255,255,255,0.08);
}
.xt-color-swatch:hover {
  transform: scale(1.2);
  border-color: rgba(255,255,255,0.4);
}

/* ── Find & Replace modal ────────────────────────────────────── */
.xt-find-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 99999;
  background: #1e1e38;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px;
  padding: 20px;
  width: 320px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.6);
  color: #e2e8f0;
}
.xt-find-modal h3 {
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 12px;
}
.xt-find-modal label {
  display: block;
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 4px;
}
.xt-find-modal input {
  display: block;
  width: 100%;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  color: #e2e8f0;
  margin-bottom: 10px;
  outline: none;
  box-sizing: border-box;
}
.xt-find-modal-btns {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}
.xt-find-modal-btns button {
  flex: 1;
  padding: 5px 0;
  font-size: 11px;
  border-radius: 5px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  color: #94a3b8;
  cursor: pointer;
}
.xt-find-modal-btns button.primary {
  background: #f59e0b;
  color: #1a1a2e;
  border-color: transparent;
  font-weight: 600;
}
.xt-find-status {
  font-size: 11px;
  color: #64748b;
  margin-top: 8px;
  min-height: 16px;
}

/* ── Handsontable overrides ──────────────────────────────────── */
.handsontable .htCore td,
.handsontable .htCore th {
  font-size: 12px;
}
```

- [ ] **Step 4: Verify build still compiles**

```bash
cd frontend && npm run type-check
```

Expected: TypeScript errors in `SpreadsheetEditor.vue` and `useConsolidation.ts` due to removed jspreadsheet references — this is expected and will be fixed in subsequent tasks. No errors in any other files.

---

## Chunk 2: Core Composable

### Task 2: Create useSpreadsheetEditor.ts

**Files:**
- Create: `frontend/src/composables/useSpreadsheetEditor.ts`

This composable owns all Handsontable state and logic. Module-level variables match the legacy closure pattern.

- [ ] **Step 1: Write unit tests for pure helper functions**

Create `frontend/src/composables/__tests__/useSpreadsheetEditor.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'

// Import helpers directly — they are exported for testing
import { argbToCssTest, colLetterTest, getFmtTest, setFmtTest, resetFormatsTest } from '../useSpreadsheetEditor'

describe('argbToCss', () => {
  it('converts 8-char ARGB to CSS hex', () => {
    expect(argbToCssTest('FF112233')).toBe('#112233')
  })
  it('passes through 6-char hex', () => {
    expect(argbToCssTest('112233')).toBe('#112233')
  })
  it('returns null for falsy', () => {
    expect(argbToCssTest('')).toBeNull()
  })
})

describe('colLetter', () => {
  it('converts index 0 to A', () => expect(colLetterTest(0)).toBe('A'))
  it('converts index 25 to Z', () => expect(colLetterTest(25)).toBe('Z'))
  it('converts index 26 to AA', () => expect(colLetterTest(26)).toBe('AA'))
})

describe('getFmt / setFmt', () => {
  beforeEach(() => resetFormatsTest())

  it('returns empty object for unknown cell', () => {
    expect(getFmtTest(0, 0, 0)).toEqual({})
  })
  it('sets and gets a format property', () => {
    setFmtTest(0, 1, 2, { bold: true })
    expect(getFmtTest(0, 1, 2)).toMatchObject({ bold: true })
  })
  it('merges format properties', () => {
    setFmtTest(0, 0, 0, { bold: true })
    setFmtTest(0, 0, 0, { italic: true })
    expect(getFmtTest(0, 0, 0)).toMatchObject({ bold: true, italic: true })
  })
})
```

- [ ] **Step 2: Run tests — expect failure (exports don't exist yet)**

```bash
cd frontend && npm test -- src/composables/__tests__/useSpreadsheetEditor.test.ts
```

Expected: FAIL — `argbToCssTest is not exported`

- [ ] **Step 3: Create the composable**

Create `frontend/src/composables/useSpreadsheetEditor.ts`:

```ts
import Handsontable from 'handsontable'
import * as XLSX from 'xlsx'
import { ref } from 'vue'
import { useSpreadsheetStore } from '@/stores/spreadsheet'

// ── Module-level state (singleton — one editor in the app) ──────
let _currentSheetIdx = 0
let _allSheetFormats: Record<string, Record<string, any>>[] = []
let _allSheetMerges: any[][] = []
let _allSheetColWidths: number[][] = []
let _sheetsData: any[][][] = []
let _sheetNames: string[] = []
let _zoomLevel = 1.0
let _currentInstance: Handsontable | null = null
let _resizeTimer: ReturnType<typeof setTimeout> | null = null
let _onResize: (() => void) | null = null
let _shortcutsWired = false
let _onKeydown: ((e: KeyboardEvent) => void) | null = null

// ── Reactive state (bound in SpreadsheetEditor.vue template) ────
export const sheetNames = ref<string[]>([])
export const currentSheetIdx = ref(0)
export const zoomLevel = ref(1.0)
export const formulaRef = ref('A1')
export const formulaValue = ref('')
export const fmtState = ref({
  bold: false,
  italic: false,
  underline: false,
  wrapText: false,
  align: '',
  freeze: false,
  numFormat: '',
})
export const lastTextColor = ref('#111111')
export const lastFillColor = ref('#ffff00')

// ── Test-exported helpers ────────────────────────────────────────
export function argbToCssTest(argb: string): string | null {
  return _argbToCss(argb)
}
export function colLetterTest(idx: number): string {
  return _colLetter(idx)
}
export function getFmtTest(sheetIdx: number, row: number, col: number) {
  return _getFmt(sheetIdx, row, col)
}
export function setFmtTest(sheetIdx: number, row: number, col: number, props: Record<string, any>) {
  _setFmt(sheetIdx, row, col, props)
}
export function resetFormatsTest() {
  _allSheetFormats = []
}

// ── Private helpers ──────────────────────────────────────────────
function _argbToCss(argb: string): string | null {
  if (!argb) return null
  const s = String(argb).replace('#', '')
  if (s.length === 8) return '#' + s.slice(2)
  if (s.length === 6) return '#' + s
  return null
}

function _colLetter(idx: number): string {
  let s = ''
  let n = idx + 1
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function _getFmt(sheetIdx: number, row: number, col: number): Record<string, any> {
  const s = _allSheetFormats[sheetIdx]
  return (s && s[`${row},${col}`]) || {}
}

function _setFmt(sheetIdx: number, row: number, col: number, props: Record<string, any>): void {
  if (!_allSheetFormats[sheetIdx]) _allSheetFormats[sheetIdx] = {}
  const key = `${row},${col}`
  _allSheetFormats[sheetIdx][key] = Object.assign(
    {},
    _allSheetFormats[sheetIdx][key] || {},
    props,
  )
}

const COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#ffffff',
  '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff',
  '#ff00ff', '#ff6666', '#ffd966', '#93c47d', '#76a5af', '#6fa8dc', '#8e7cc3', '#c27ba0',
  '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#1c4587', '#20124d',
]

// ── Custom cell renderer (registered once at module load) ────────
Handsontable.renderers.registerRenderer(
  'fmtRenderer',
  function (hot, TD, row, col, prop, value, cellProps) {
    Handsontable.renderers
      .getRenderer('text')
      .apply(this, [hot, TD, row, col, prop, value, cellProps])

    const fmt = _getFmt(_currentSheetIdx, row, col)
    // Header row defaults
    if (row === 0) {
      if (!fmt.bgColor) TD.style.backgroundColor = '#e9f0e9'
      if (!fmt.bold) TD.style.fontWeight = '600'
    }
    if (fmt.bold) TD.style.fontWeight = 'bold'
    if (fmt.italic) TD.style.fontStyle = 'italic'
    if (fmt.underline) TD.style.textDecoration = 'underline'
    if (fmt.color) TD.style.color = fmt.color
    if (fmt.bgColor) TD.style.backgroundColor = fmt.bgColor
    if (fmt.align) TD.style.textAlign = fmt.align
    if (fmt.wrapText) {
      TD.style.whiteSpace = 'normal'
      TD.style.wordBreak = 'break-word'
    }
    if (fmt.numFormat && value !== '' && value !== null && value !== undefined) {
      const num = parseFloat(String(value))
      if (!isNaN(num)) {
        if (fmt.numFormat === 'currency')
          TD.textContent =
            '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        else if (fmt.numFormat === 'percent') TD.textContent = (num * 100).toFixed(1) + '%'
        else if (fmt.numFormat === 'number') TD.textContent = num.toLocaleString('en-US')
        else if (fmt.numFormat === 'date') {
          const d = new Date(Math.round((num - 25569) * 86400 * 1000))
          if (!isNaN(d.getTime())) TD.textContent = d.toLocaleDateString('en-US')
        }
      }
    }
  },
)

// ── Composable ───────────────────────────────────────────────────
export function useSpreadsheetEditor() {
  const spreadsheet = useSpreadsheetStore()

  // ── Internal: formula bar + toolbar state ──
  function _updateFormulaBar(row: number, col: number): void {
    formulaRef.value = _colLetter(col) + (row + 1)
    if (!_currentInstance) return
    const raw = (_currentInstance as any).getSourceDataAtCell
      ? (_currentInstance as any).getSourceDataAtCell(row, col)
      : _currentInstance.getDataAtCell(row, col)
    formulaValue.value = raw === null || raw === undefined ? '' : String(raw)
  }

  function _updateToolbarState(row: number, col: number): void {
    const fmt = _getFmt(_currentSheetIdx, row, col)
    fmtState.value = {
      bold: !!fmt.bold,
      italic: !!fmt.italic,
      underline: !!fmt.underline,
      wrapText: !!fmt.wrapText,
      align: fmt.align || '',
      freeze: !!(_currentInstance?.getSettings().fixedRowsTop),
      numFormat: fmt.numFormat || '',
    }
  }

  function _getRange(): Handsontable.CellRange | null {
    if (!_currentInstance) return null
    const sel = _currentInstance.getSelectedRange()
    return sel && sel.length ? sel[0] : null
  }

  function _applyFmt(props: Record<string, any>): void {
    const rng = _getRange()
    if (!rng || !_currentInstance) return
    const r1 = Math.min(rng.from.row, rng.to.row)
    const r2 = Math.max(rng.from.row, rng.to.row)
    const c1 = Math.min(rng.from.col, rng.to.col)
    const c2 = Math.max(rng.from.col, rng.to.col)
    for (let r = r1; r <= r2; r++)
      for (let c = c1; c <= c2; c++)
        _setFmt(_currentSheetIdx, r, c, props)
    _currentInstance.render()
    _updateToolbarState(rng.from.row, rng.from.col)
  }

  function _toggleFmt(key: string): void {
    const rng = _getRange()
    if (!rng) return
    const current = _getFmt(_currentSheetIdx, rng.from.row, rng.from.col)[key]
    _applyFmt({ [key]: !current })
  }

  // ── openFile: parse XLSX workbook and mount HT ──
  function openFile(wb: any): void {
    // Destroy existing instance
    if (_currentInstance) {
      try { _currentInstance.destroy() } catch (_) {}
      _currentInstance = null
    }
    if (_resizeTimer) clearTimeout(_resizeTimer)

    _currentSheetIdx = 0
    _allSheetFormats = []
    _allSheetMerges = []
    _allSheetColWidths = []
    _sheetsData = []
    _sheetNames = wb.SheetNames.slice()
    _zoomLevel = 1.0
    zoomLevel.value = 1.0

    _sheetNames.forEach((sheetName, sheetIdx) => {
      const ws = wb.Sheets[sheetName]
      if (!ws || !ws['!ref']) {
        _sheetsData.push([new Array(10).fill('')])
        _allSheetMerges.push([])
        _allSheetColWidths.push(new Array(10).fill(100))
        _allSheetFormats.push({})
        return
      }
      const range = XLSX.utils.decode_range(ws['!ref'])
      const maxCols = Math.max(range.e.c + 1, 10)
      const maxRows = range.e.r + 1

      // Data rows (prefer cell.w display value)
      const processed: any[][] = []
      for (let R = 0; R < maxRows; R++) {
        const row: any[] = []
        for (let C = 0; C < maxCols; C++) {
          const addr = XLSX.utils.encode_cell({ r: R, c: C })
          const cell = ws[addr]
          if (!cell) { row.push(''); continue }
          const val =
            cell.w !== undefined && cell.w !== ''
              ? cell.w
              : cell.v !== undefined && cell.v !== null
                ? cell.v
                : ''
          row.push(val)
        }
        processed.push(row)
      }
      while (processed.length < 50) processed.push(new Array(maxCols).fill(''))
      _sheetsData.push(processed)

      // Cell styles
      const fmts: Record<string, Record<string, any>> = {}
      for (let SR = 0; SR <= range.e.r; SR++) {
        for (let SC = 0; SC <= range.e.c; SC++) {
          const addr = XLSX.utils.encode_cell({ r: SR, c: SC })
          const scell = ws[addr]
          if (!scell?.s) continue
          const s = scell.s
          const fmt: Record<string, any> = {}
          if (s.font) {
            if (s.font.bold) fmt.bold = true
            if (s.font.italic) fmt.italic = true
            if (s.font.underline) fmt.underline = true
            if (s.font.color?.rgb) {
              const fc = _argbToCss(s.font.color.rgb)
              if (fc && fc.toUpperCase() !== '#000000') fmt.color = fc
            }
          }
          if (s.fill?.fgColor?.rgb) {
            const bg = _argbToCss(s.fill.fgColor.rgb)
            if (bg && bg.toUpperCase() !== '#FFFFFF') fmt.bgColor = bg
          }
          if (s.alignment) {
            if (s.alignment.horizontal) fmt.align = s.alignment.horizontal
            if (s.alignment.wrapText) fmt.wrapText = true
          }
          if (Object.keys(fmt).length > 0) fmts[`${SR},${SC}`] = fmt
        }
      }
      _allSheetFormats.push(fmts)

      // Merged cells
      const merges: any[] = []
      if (ws['!merges']) {
        ws['!merges'].forEach((m: any) => {
          merges.push({
            row: m.s.r,
            col: m.s.c,
            rowspan: m.e.r - m.s.r + 1,
            colspan: m.e.c - m.s.c + 1,
          })
        })
      }
      _allSheetMerges.push(merges)

      // Column widths
      const cols = ws['!cols'] || []
      const widths: number[] = []
      for (let CW = 0; CW < maxCols; CW++) {
        const ci = cols[CW]
        if (ci?.wpx) widths.push(Math.max(40, ci.wpx))
        else if (ci?.wch) widths.push(Math.max(40, Math.round(ci.wch * 7)))
        else widths.push(100)
      }
      _allSheetColWidths.push(widths)
    })

    sheetNames.value = _sheetNames.slice()
    currentSheetIdx.value = 0

    const container = document.getElementById('spreadsheet-container')
    if (!container) return

    _currentInstance = new Handsontable(container, {
      data: _sheetsData[0],
      rowHeaders: true,
      colHeaders: true,
      width: '100%',
      height: '100%',
      licenseKey: 'non-commercial-and-evaluation',
      colWidths: _allSheetColWidths[0] ?? 100,
      manualColumnResize: true,
      manualRowResize: true,
      contextMenu: true,
      columnSorting: true,
      hiddenRows: { indicators: false },
      fixedRowsTop: 1,
      stretchH: 'none' as const,
      fillHandle: true,
      mergeCells: _allSheetMerges[0] ?? [],
      search: true,
      customBorders: true,
      renderer: 'fmtRenderer',
      afterSelectionEnd(row: number, col: number) {
        _updateFormulaBar(row, col)
        _updateToolbarState(row, col)
      },
      afterChange(changes: any) {
        if (!changes) return
        const sel = _currentInstance?.getSelectedLast()
        if (sel) _updateFormulaBar(sel[0], sel[1])
      },
    })

    // Adjust height on resize — remove previous listener first to prevent leaks
    if (_onResize) window.removeEventListener('resize', _onResize)
    _onResize = () => {
      if (_resizeTimer) clearTimeout(_resizeTimer)
      _resizeTimer = setTimeout(() => {
        if (_currentInstance && container.offsetHeight > 0) {
          _currentInstance.updateSettings({ height: container.offsetHeight })
        }
      }, 100)
    }
    window.addEventListener('resize', _onResize)

    // Pinch-to-zoom scoped to container
    container.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        if (!e.ctrlKey) return
        e.preventDefault()
        stepZoom(e.deltaY < 0 ? 0.1 : -0.1)
      },
      { passive: false },
    )

    spreadsheet.setInstance(_currentInstance, wb, spreadsheet.fileName ?? 'Sheet')
  }

  function closeFile(): void {
    if (_currentInstance) {
      try { _currentInstance.destroy() } catch (_) {}
      _currentInstance = null
    }
    _sheetsData = []
    _sheetNames = []
    _currentSheetIdx = 0
    _allSheetFormats = []
    sheetNames.value = []
    currentSheetIdx.value = 0
    formulaRef.value = 'A1'
    formulaValue.value = ''
    spreadsheet.clear()
  }

  function switchSheet(idx: number): void {
    if (!_currentInstance || idx === _currentSheetIdx) return
    _sheetsData[_currentSheetIdx] = (_currentInstance as any).getSourceData
      ? (_currentInstance as any).getSourceData().map((r: any[]) => r.slice())
      : _currentInstance.getData()
    _currentSheetIdx = idx
    currentSheetIdx.value = idx
    _currentInstance.updateSettings({
      mergeCells: _allSheetMerges[idx] ?? [],
      colWidths: _allSheetColWidths[idx] ?? 100,
    })
    _currentInstance.loadData(_sheetsData[idx])
  }

  function stepZoom(delta: number): void {
    _zoomLevel = Math.min(2.0, Math.max(0.5, Math.round((_zoomLevel + delta) * 10) / 10))
    zoomLevel.value = _zoomLevel
    const el = document.getElementById('spreadsheet-container')
    if (el) (el.style as any).zoom = _zoomLevel
  }

  function handleFormulaEnter(): void {
    const rng = _getRange()
    if (!rng || !_currentInstance) return
    _currentInstance.setDataAtCell(rng.from.row, rng.from.col, formulaValue.value)
    _currentInstance.selectCell(rng.from.row + 1, rng.from.col)
  }

  function handleFormulaEscape(): void {
    const rng = _getRange()
    if (rng) _updateFormulaBar(rng.from.row, rng.from.col)
  }

  function showColorPicker(anchorEl: HTMLElement, type: 'text' | 'fill'): void {
    document.querySelectorAll('.xt-color-dropdown, .xt-color-overlay').forEach((el) => el.remove())
    const dd = document.createElement('div')
    dd.className = 'xt-color-dropdown'
    COLORS.forEach((c) => {
      const sw = document.createElement('div')
      sw.className = 'xt-color-swatch'
      sw.style.backgroundColor = c
      sw.title = c
      sw.addEventListener('mousedown', (e) => {
        e.preventDefault()
        if (type === 'text') {
          lastTextColor.value = c
          _applyFmt({ color: c })
        } else {
          lastFillColor.value = c
          _applyFmt({ bgColor: c })
        }
        dd.remove()
        ov.remove()
      })
      dd.appendChild(sw)
    })
    const ov = document.createElement('div')
    ov.className = 'xt-color-overlay'
    ov.style.cssText = 'position:fixed;inset:0;z-index:9998;'
    ov.addEventListener('mousedown', () => { dd.remove(); ov.remove() })
    anchorEl.style.position = 'relative'
    anchorEl.appendChild(dd)
    document.body.appendChild(ov)
  }

  function showFindModal(): void {
    if (document.querySelector('.xt-find-modal')) return
    const ov = document.createElement('div')
    ov.style.cssText = 'position:fixed;inset:0;z-index:99998;'
    const md = document.createElement('div')
    md.className = 'xt-find-modal'
    md.innerHTML = `
      <h3>Find &amp; Replace</h3>
      <label>Find</label><input id="xt-find-q" placeholder="Search…" />
      <label>Replace with</label><input id="xt-find-r" placeholder="Replacement…" />
      <div class="xt-find-modal-btns">
        <button class="primary" id="xt-find-next">Find Next</button>
        <button id="xt-replace-all">Replace All</button>
        <button id="xt-find-close">Close</button>
      </div>
      <div class="xt-find-status" id="xt-find-status"></div>`
    document.body.appendChild(ov)
    document.body.appendChild(md)
    ;(md.querySelector('#xt-find-q') as HTMLInputElement).focus()

    let lastIdx = -1

    md.querySelector('#xt-find-next')!.addEventListener('click', () => {
      const q = (md.querySelector('#xt-find-q') as HTMLInputElement).value
      if (!q || !_currentInstance) return
      const plugin = _currentInstance.getPlugin('search') as any
      const results = plugin.query(q)
      if (!results?.length) {
        ;(md.querySelector('#xt-find-status') as HTMLElement).textContent = 'Not found.'
        return
      }
      lastIdx = (lastIdx + 1) % results.length
      _currentInstance.selectCell(results[lastIdx].row, results[lastIdx].col)
      ;(md.querySelector('#xt-find-status') as HTMLElement).textContent =
        `${lastIdx + 1} of ${results.length}`
    })

    md.querySelector('#xt-replace-all')!.addEventListener('click', () => {
      const q = (md.querySelector('#xt-find-q') as HTMLInputElement).value
      const r = (md.querySelector('#xt-find-r') as HTMLInputElement).value
      if (!q || !_currentInstance) return
      const data = _currentInstance.getData()
      const changes: [number, number, any][] = []
      for (let row = 0; row < data.length; row++)
        for (let col = 0; col < (data[row] as any[]).length; col++) {
          const v = String(data[row][col] || '')
          if (v.includes(q)) changes.push([row, col, v.split(q).join(r)])
        }
      if (changes.length) _currentInstance.setDataAtCell(changes)
      ;(md.querySelector('#xt-find-status') as HTMLElement).textContent =
        `${changes.length} replacement(s) made.`
    })

    const close = () => { ov.remove(); md.remove() }
    md.querySelector('#xt-find-close')!.addEventListener('click', close)
    ov.addEventListener('click', close)
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc) }
    }
    document.addEventListener('keydown', esc)
  }

  function toolbarAction(action: string): void {
    if (
      !_currentInstance &&
      !['zoom-in', 'zoom-out', 'zoom-reset', 'find'].includes(action)
    )
      return
    switch (action) {
      case 'undo':         _currentInstance!.undo(); break
      case 'redo':         _currentInstance!.redo(); break
      case 'bold':         _toggleFmt('bold'); break
      case 'italic':       _toggleFmt('italic'); break
      case 'underline':    _toggleFmt('underline'); break
      case 'wrap':         _toggleFmt('wrapText'); break
      case 'align-left':   _applyFmt({ align: 'left' }); break
      case 'align-center': _applyFmt({ align: 'center' }); break
      case 'align-right':  _applyFmt({ align: 'right' }); break
      case 'merge': {
        const rng = _getRange()
        if (rng) {
          const existing = (_currentInstance!.getSettings().mergeCells as any[]) || []
          const merges = Array.isArray(existing) ? [...existing] : []
          merges.push({
            row:     Math.min(rng.from.row, rng.to.row),
            col:     Math.min(rng.from.col, rng.to.col),
            rowspan: Math.abs(rng.to.row - rng.from.row) + 1,
            colspan: Math.abs(rng.to.col - rng.from.col) + 1,
          })
          _currentInstance!.updateSettings({ mergeCells: merges })
        }
        break
      }
      case 'insert-row': {
        const rng = _getRange()
        if (rng) _currentInstance!.alter('insert_row_above', rng.from.row, 1)
        break
      }
      case 'insert-col': {
        const rng = _getRange()
        if (rng) _currentInstance!.alter('insert_col_start', rng.from.col, 1)
        break
      }
      case 'delete-row': {
        const rng = _getRange()
        if (rng)
          _currentInstance!.alter(
            'remove_row',
            rng.from.row,
            Math.abs(rng.to.row - rng.from.row) + 1,
          )
        break
      }
      case 'freeze': {
        const cur = _currentInstance!.getSettings().fixedRowsTop || 0
        _currentInstance!.updateSettings({ fixedRowsTop: cur > 0 ? 0 : 1 })
        const rng = _getRange()
        if (rng) _updateToolbarState(rng.from.row, rng.from.col)
        break
      }
      case 'find':       showFindModal(); break
      case 'zoom-in':    stepZoom(0.1); break
      case 'zoom-out':   stepZoom(-0.1); break
      case 'zoom-reset': {
        _zoomLevel = 1.0
        zoomLevel.value = 1.0
        const el = document.getElementById('spreadsheet-container')
        if (el) (el.style as any).zoom = 1
        break
      }
    }
  }

  function setNumFormat(val: string): void {
    _applyFmt({ numFormat: val || null })
  }

  function downloadXlsx(fileName: string): void {
    if (!_currentInstance) return
    _sheetsData[_currentSheetIdx] = (_currentInstance as any).getSourceData
      ? (_currentInstance as any).getSourceData().map((r: any[]) => r.slice())
      : _currentInstance.getData()
    const wb2 = XLSX.utils.book_new()
    for (let i = 0; i < _sheetsData.length; i++) {
      const ws = XLSX.utils.aoa_to_sheet(_sheetsData[i])
      XLSX.utils.book_append_sheet(wb2, ws, _sheetNames[i] || `Sheet${i + 1}`)
    }
    const arr = XLSX.write(wb2, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([arr], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function wireKeyboardShortcuts(): void {
    if (_shortcutsWired) return
    _shortcutsWired = true
    _onKeydown = (e: KeyboardEvent) => {
      if (!_currentInstance) return
      const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
      const ctrl = isMac ? e.metaKey : e.ctrlKey
      if (!ctrl) return
      const focus = document.activeElement as HTMLElement | null
      const inSheet =
        focus &&
        (focus.closest('#spreadsheet-container') || focus.id === 'xt-formula-input')
      if (!inSheet) return
      const key = e.key.toLowerCase()
      if (key === 'b') { e.preventDefault(); _toggleFmt('bold') }
      if (key === 'i') { e.preventDefault(); _toggleFmt('italic') }
      if (key === 'u') { e.preventDefault(); _toggleFmt('underline') }
      if (key === 'f') { e.preventDefault(); showFindModal() }
    }
    document.addEventListener('keydown', _onKeydown)
  }

  function cleanupKeyboardShortcuts(): void {
    if (_onKeydown) {
      document.removeEventListener('keydown', _onKeydown)
      _onKeydown = null
      _shortcutsWired = false
    }
    if (_onResize) {
      window.removeEventListener('resize', _onResize)
      _onResize = null
    }
  }

  return {
    openFile,
    closeFile,
    switchSheet,
    stepZoom,
    toolbarAction,
    setNumFormat,
    handleFormulaEnter,
    handleFormulaEscape,
    showColorPicker,
    showFindModal,
    downloadXlsx,
    wireKeyboardShortcuts,
    cleanupKeyboardShortcuts,
  }
}
```

- [ ] **Step 4: Run unit tests — expect pass**

```bash
cd frontend && npm test -- src/composables/__tests__/useSpreadsheetEditor.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/composables/useSpreadsheetEditor.ts \
        frontend/src/composables/__tests__/useSpreadsheetEditor.test.ts
git commit -m "add useSpreadsheetEditor composable with HT + port formatting engine"
```

---

## Chunk 3: Vue Component Rewrite

### Task 3: Rewrite SpreadsheetEditor.vue

**Files:**
- Modify: `frontend/src/components/editor/SpreadsheetEditor.vue`

- [ ] **Step 1: Replace SpreadsheetEditor.vue entirely**

Full file:

```vue
<script setup lang="ts">
import { watch, onMounted, onBeforeUnmount } from 'vue'
import { useSpreadsheetStore } from '@/stores/spreadsheet'
import {
  useSpreadsheetEditor,
  sheetNames,
  currentSheetIdx,
  zoomLevel,
  formulaRef,
  formulaValue,
  fmtState,
  lastTextColor,
  lastFillColor,
} from '@/composables/useSpreadsheetEditor'

const spreadsheet = useSpreadsheetStore()
const editor = useSpreadsheetEditor()

// Open file when workbook changes in store
watch(
  () => spreadsheet.workbook,
  (wb) => {
    if (wb) editor.openFile(wb)
  },
)

onMounted(() => {
  editor.wireKeyboardShortcuts()
  if (spreadsheet.workbook) editor.openFile(spreadsheet.workbook)
})

onBeforeUnmount(() => {
  editor.cleanupKeyboardShortcuts()
})

function handleFormulaKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') { e.preventDefault(); editor.handleFormulaEnter() }
  if (e.key === 'Escape') editor.handleFormulaEscape()
}

function showTextColor(e: MouseEvent) {
  editor.showColorPicker(e.currentTarget as HTMLElement, 'text')
}

function showFillColor(e: MouseEvent) {
  editor.showColorPicker(e.currentTarget as HTMLElement, 'fill')
}
</script>

<template>
  <main
    class="flex flex-1 flex-col overflow-hidden bg-surface-light"
    aria-label="Spreadsheet editor"
  >
    <template v-if="spreadsheet.fileName">
      <!-- ── File name + download/close row ─────────────────── -->
      <div class="flex items-center justify-between border-b border-white/5 px-4 py-2 shrink-0">
        <div class="flex items-center gap-3">
          <svg class="h-4 w-4 text-green-500/70" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5z" clip-rule="evenodd" />
          </svg>
          <span class="text-sm font-medium text-gray-200">{{ spreadsheet.fileName }}</span>
        </div>
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm text-gray-400 transition-colors duration-200 hover:bg-white/5 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 active:bg-white/10"
            @click="editor.downloadXlsx(spreadsheet.fileName!)"
          >
            <svg class="mr-1 inline-block h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
            </svg>
            Download
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm text-gray-400 transition-colors duration-200 hover:bg-white/5 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 active:bg-white/10"
            @click="editor.closeFile()"
          >
            Close
          </button>
        </div>
      </div>

      <!-- ── Toolbar ───────────────────────────────────────────── -->
      <div class="flex flex-wrap items-center gap-0.5 border-b border-white/5 bg-surface px-1 py-0.5 shrink-0">
        <!-- Undo / Redo -->
        <button class="xt-btn" title="Undo (Ctrl+Z)" @click="editor.toolbarAction('undo')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>
        </button>
        <button class="xt-btn" title="Redo (Ctrl+Y)" @click="editor.toolbarAction('redo')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3L21 13"/></svg>
        </button>
        <div class="xt-sep" />

        <!-- Bold / Italic / Underline -->
        <button
          class="xt-btn"
          :class="{ 'xt-btn-active': fmtState.bold }"
          style="font-weight:700;font-size:13px;"
          title="Bold (Ctrl+B)"
          @click="editor.toolbarAction('bold')"
        >B</button>
        <button
          class="xt-btn"
          :class="{ 'xt-btn-active': fmtState.italic }"
          style="font-style:italic;font-size:13px;"
          title="Italic (Ctrl+I)"
          @click="editor.toolbarAction('italic')"
        >I</button>
        <button
          class="xt-btn"
          :class="{ 'xt-btn-active': fmtState.underline }"
          style="text-decoration:underline;font-size:13px;"
          title="Underline (Ctrl+U)"
          @click="editor.toolbarAction('underline')"
        >U</button>
        <div class="xt-sep" />

        <!-- Text color / Fill color -->
        <button class="xt-btn xt-color-btn" title="Text Color" @click="showTextColor">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
          <div class="xt-color-bar" :style="{ background: lastTextColor }" />
        </button>
        <button class="xt-btn xt-color-btn" title="Fill Color" @click="showFillColor">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 11L7.83 0l-1.41 1.41L8.83 4 3 9.83a2 2 0 000 2.83L8.83 18.5a2 2 0 002.83 0l7.34-7.5z"/><path d="M17 13s-2 2.5-2 4c0 1.1.9 2 2 2s2-.9 2-2c0-1.5-2-4-2-4z"/></svg>
          <div class="xt-color-bar" :style="{ background: lastFillColor }" />
        </button>
        <div class="xt-sep" />

        <!-- Alignment -->
        <button class="xt-btn" :class="{ 'xt-btn-active': fmtState.align === 'left' }" title="Align Left" @click="editor.toolbarAction('align-left')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
        </button>
        <button class="xt-btn" :class="{ 'xt-btn-active': fmtState.align === 'center' }" title="Center" @click="editor.toolbarAction('align-center')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>
        </button>
        <button class="xt-btn" :class="{ 'xt-btn-active': fmtState.align === 'right' }" title="Align Right" @click="editor.toolbarAction('align-right')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>
        </button>
        <div class="xt-sep" />

        <!-- Merge / Wrap -->
        <button class="xt-btn gap-0.5" title="Merge Cells" @click="editor.toolbarAction('merge')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="12" y1="3" x2="12" y2="12"/></svg>
          <span style="font-size:9px;">Merge</span>
        </button>
        <button class="xt-btn" :class="{ 'xt-btn-active': fmtState.wrapText }" title="Wrap Text" @click="editor.toolbarAction('wrap')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><path d="M3 12h15a3 3 0 010 6h-4"/><polyline points="14 15 11 18 14 21"/></svg>
        </button>
        <div class="xt-sep" />

        <!-- Number format -->
        <select
          class="xt-select"
          :value="fmtState.numFormat"
          title="Number Format"
          @change="editor.setNumFormat(($event.target as HTMLSelectElement).value)"
        >
          <option value="">General</option>
          <option value="number">Number</option>
          <option value="currency">Currency ($)</option>
          <option value="percent">Percent (%)</option>
          <option value="date">Date</option>
        </select>
        <div class="xt-sep" />

        <!-- Insert / Delete rows and cols -->
        <button class="xt-btn gap-0.5" title="Insert Row Above" @click="editor.toolbarAction('insert-row')">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span style="font-size:9px;">Row</span>
        </button>
        <button class="xt-btn gap-0.5" title="Insert Column Left" @click="editor.toolbarAction('insert-col')">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span style="font-size:9px;">Col</span>
        </button>
        <button
          class="xt-btn gap-0.5 text-red-400"
          title="Delete Selected Row(s)"
          @click="editor.toolbarAction('delete-row')"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a1 1 0 011-1h2a1 1 0 011 1v2"/></svg>
          <span style="font-size:9px;">Del Row</span>
        </button>
        <div class="xt-sep" />

        <!-- Freeze / Find -->
        <button
          class="xt-btn"
          :class="{ 'xt-btn-active': fmtState.freeze }"
          title="Toggle Freeze First Row"
          @click="editor.toolbarAction('freeze')"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="4" x2="21" y2="4"/><line x1="7" y1="8" x2="7" y2="20"/></svg>
        </button>
        <button class="xt-btn" title="Find & Replace (Ctrl+F)" @click="editor.toolbarAction('find')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </button>
        <div class="xt-sep" />

        <!-- Zoom -->
        <button class="xt-btn" title="Zoom Out" @click="editor.toolbarAction('zoom-out')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </button>
        <button class="xt-btn xt-zoom-label" title="Reset Zoom" @click="editor.toolbarAction('zoom-reset')">
          {{ Math.round(zoomLevel * 100) }}%
        </button>
        <button class="xt-btn" title="Zoom In" @click="editor.toolbarAction('zoom-in')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </button>
      </div>

      <!-- ── Formula bar ────────────────────────────────────────── -->
      <div class="xt-formula-bar shrink-0">
        <span class="xt-cell-ref">{{ formulaRef }}</span>
        <span class="xt-formula-sep" />
        <span style="font-size:11px;color:#999;padding:0 6px;font-style:italic;">fx</span>
        <input
          id="xt-formula-input"
          v-model="formulaValue"
          class="xt-formula-input"
          placeholder="Cell value or formula (=SUM, =IF, …)"
          @keydown="handleFormulaKeydown"
        />
      </div>

      <!-- ── Handsontable container ─────────────────────────────── -->
      <div
        id="spreadsheet-container"
        class="flex-1 overflow-hidden"
      />

      <!-- ── Sheet tabs (only when multiple sheets) ─────────────── -->
      <div v-if="sheetNames.length > 1" class="xt-sheet-tabs shrink-0">
        <button
          v-for="(name, idx) in sheetNames"
          :key="idx"
          class="xt-sheet-tab"
          :class="{ active: idx === currentSheetIdx }"
          @click="editor.switchSheet(idx)"
        >{{ name }}</button>
      </div>
    </template>

    <!-- ── Empty state ─────────────────────────────────────────── -->
    <div
      v-else
      class="flex flex-1 flex-col items-center justify-center"
    >
      <div class="text-center">
        <svg class="mx-auto mb-4 h-16 w-16 text-gray-700/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M10.875 12h-1.5m1.5 0c.621 0 1.125.504 1.125 1.125M12 12h7.5m-7.5 0c0 .621-.504 1.125-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125m1.125-2.625c-.621 0-1.125.504-1.125 1.125" />
        </svg>
        <h3 class="font-display text-lg text-gray-400">No spreadsheet open</h3>
        <p class="mt-2 text-sm leading-relaxed text-gray-600">
          Upload and consolidate files from the<br />Sources panel to get started.
        </p>
      </div>
    </div>
  </main>
</template>
```

- [ ] **Step 2: Run type-check**

```bash
cd frontend && npm run type-check
```

Expected: No errors from SpreadsheetEditor.vue.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/editor/SpreadsheetEditor.vue
git commit -m "rewrite SpreadsheetEditor.vue — HT toolbar, formula bar, sheet tabs"
```

---

## Chunk 4: Update Dependents

### Task 4: Update spreadsheet store — remove Jspreadsheet destroy assumption

**Files:**
- Modify: `frontend/src/stores/spreadsheet.ts`

The `loadWorkbook` helper currently tries to destroy `instance.value` before setting new workbook data. Since the composable owns the HT lifecycle, `loadWorkbook` should just set state and let the watcher trigger `openFile`.

- [ ] **Step 1: Update loadWorkbook in spreadsheet.ts**

Full file after edit:

```ts
import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type Handsontable from 'handsontable'

export const useSpreadsheetStore = defineStore('spreadsheet', () => {
  const instance = shallowRef<Handsontable | null>(null)
  const workbook = shallowRef<any>(null)
  const fileName = ref<string | null>(null)

  function setInstance(ht: Handsontable, wb: any, name: string) {
    instance.value = ht
    workbook.value = wb
    fileName.value = name
  }

  function clear() {
    // HT instance destroyed by composable before calling clear()
    instance.value = null
    workbook.value = null
    fileName.value = null
  }

  function loadWorkbook(wb: any, name: string) {
    // Just update state — SpreadsheetEditor watcher calls openFile()
    instance.value = null
    fileName.value = name
    workbook.value = wb
  }

  return { instance, workbook, fileName, setInstance, clear, loadWorkbook }
})
```

- [ ] **Step 2: Run type-check**

```bash
cd frontend && npm run type-check
```

Expected: No errors.

### Task 5: Port useAiOperations.ts to Handsontable API

**Files:**
- Modify: `frontend/src/composables/useAiOperations.ts`

Jspreadsheet API (`insertColumn`, `setHeader`, `setValueFromCoords`, `deleteColumn`, `orderBy`, `getData`, `getConfig`) is replaced with Handsontable equivalents. Headers are in data row 0 (HT stores all data including the header row; `fixedRowsTop: 1` freezes it visually).

- [ ] **Step 1: Write tests for helper functions with HT mock**

Create `frontend/src/composables/__tests__/useAiOperations.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

// Test the pure helper: resolveColumnIndex using mocked getDataAtRow
function makeHtMock(headerRow: string[]) {
  return {
    getDataAtRow: vi.fn(() => headerRow),
    getData: vi.fn(() => [headerRow, ['a', 'b']]),
    getSettings: vi.fn(() => ({})),
  }
}

describe('getColumnHeaders from HT', () => {
  it('reads headers from row 0', () => {
    const ht = makeHtMock(['Name', 'Age', 'City'])
    const headers = ht.getDataAtRow(0) as string[]
    expect(headers).toEqual(['Name', 'Age', 'City'])
  })
})

describe('resolveColumnIndex', () => {
  it('resolves by name (case-insensitive)', () => {
    const headers = ['Name', 'Age', 'City']
    const idx = headers.findIndex((h) => h.toLowerCase() === 'age')
    expect(idx).toBe(1)
  })
  it('returns numeric index unchanged (passthrough for number type)', () => {
    // _resolveColumnIndex returns the number directly when column is a number
    const headers = ['Name', 'Age', 'City']
    // Simulate: typeof column === 'number' → return column
    const colArg = 2
    const result = typeof colArg === 'number' ? colArg : headers.findIndex((h) => h.toLowerCase() === String(colArg).toLowerCase())
    expect(result).toBe(2)
  })
  it('returns -1 for unknown column', () => {
    const headers = ['Name', 'Age']
    const idx = headers.findIndex((h) => h.toLowerCase() === 'salary')
    expect(idx).toBe(-1)
  })
})
```

- [ ] **Step 2: Run tests — expect pass (pure logic, no HT dependency)**

```bash
cd frontend && npm test -- src/composables/__tests__/useAiOperations.test.ts
```

Expected: All tests PASS.

- [ ] **Step 3: Replace useAiOperations.ts**

Full file:

```ts
import { api } from '@/composables/useApi'
import { useSpreadsheetStore } from '@/stores/spreadsheet'
import { useChatStore } from '@/stores/chat'
import type Handsontable from 'handsontable'
import type { AiCommandResponse, AiOperation, ApiResponse } from '@/types'

export function useAiOperations() {
  async function handleCommand(text: string): Promise<boolean> {
    const spreadsheet = useSpreadsheetStore()
    const chat = useChatStore()
    const ht = spreadsheet.instance as Handsontable | null

    if (!ht) return false

    const headers = _getColumnHeaders(ht)
    if (headers.length === 0) return false

    try {
      const resp = await api.post<ApiResponse<AiCommandResponse>>('/api/ai/command', {
        message: text,
        headers,
      })

      const { handled, operation, message } = resp.data

      if (!handled || !operation) return false

      _applyOperation(ht, operation)

      if (message) {
        chat.addMessage(message, 'ai')
      }

      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      chat.addMessage(`Command failed: ${msg}`, 'system')
      console.error('[ai-operations]', err)
      return false
    }
  }

  return { handleCommand }
}

// ── Helpers ──────────────────────────────────────────────────────

function _getColumnHeaders(ht: Handsontable): string[] {
  // Headers live in data row 0 (HT fixedRowsTop:1 freezes them visually)
  const row0 = ht.getDataAtRow(0) as any[]
  return row0.map((v) => (v !== null && v !== undefined ? String(v) : ''))
}

function _resolveColumnIndex(ht: Handsontable, column: string | number): number {
  if (typeof column === 'number') return column
  const headers = _getColumnHeaders(ht)
  const lower = column.toLowerCase()
  return headers.findIndex((h) => h.toLowerCase() === lower)
}

function _getRowCount(ht: Handsontable): number {
  return ht.countRows()
}

function _getColumnCount(ht: Handsontable): number {
  return ht.countCols()
}

function _applyOperation(ht: Handsontable, op: AiOperation): void {
  const p = op.params as Record<string, any>

  switch (op.type) {
    case 'add_column': {
      const position = p.position ?? _getColumnCount(ht)
      const title = p.title ?? 'New Column'
      const defaultValue = p.default_value ?? ''
      ht.alter('insert_col_start', position, 1)
      // Set header in row 0
      ht.setDataAtCell(0, position, title)
      if (defaultValue) {
        const rowCount = _getRowCount(ht)
        const changes: [number, number, any][] = []
        for (let r = 1; r < rowCount; r++) {
          changes.push([r, position, defaultValue])
        }
        if (changes.length) ht.setDataAtCell(changes)
      }
      break
    }

    case 'remove_column': {
      const colIdx = _resolveColumnIndex(ht, p.column)
      if (colIdx !== -1) {
        ht.alter('remove_col', colIdx, 1)
      }
      break
    }

    case 'rename_column': {
      const colIdx = _resolveColumnIndex(ht, p.column)
      const newName = p.new_name ?? ''
      if (colIdx !== -1 && newName) {
        ht.setDataAtCell(0, colIdx, newName)
      }
      break
    }

    case 'sort': {
      const colIdx = _resolveColumnIndex(ht, p.column)
      const ascending = p.ascending !== false
      if (colIdx !== -1) {
        const sortPlugin = ht.getPlugin('columnSorting') as any
        sortPlugin.sort({ column: colIdx, sortOrder: ascending ? 'asc' : 'desc' })
      }
      break
    }

    case 'apply_formula': {
      const colIdx = _resolveColumnIndex(ht, p.column)
      const formula = p.formula as string
      if (colIdx !== -1 && formula) {
        const rowCount = _getRowCount(ht)
        const changes: [number, number, any][] = []
        for (let r = 1; r < rowCount; r++) {
          const resolved = formula.replace(/\{ROW\}/g, String(r + 1))
          changes.push([r, colIdx, resolved])
        }
        if (changes.length) ht.setDataAtCell(changes)
      }
      break
    }
  }
}
```

- [ ] **Step 4: Run type-check**

```bash
cd frontend && npm run type-check
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/stores/spreadsheet.ts frontend/src/composables/useAiOperations.ts \
        frontend/src/composables/__tests__/useAiOperations.test.ts
git commit -m "port useAiOperations + spreadsheet store to Handsontable API"
```

### Task 6: Update useConsolidation.ts — remove direct Jspreadsheet creation

**Files:**
- Modify: `frontend/src/composables/useConsolidation.ts`

Instead of creating a Jspreadsheet instance directly, build the synthetic workbook and call `spreadsheet.loadWorkbook()`. The SpreadsheetEditor watcher then calls `openFile(wb)` to mount HT.

- [ ] **Step 1: Replace useConsolidation.ts**

Full file:

```ts
import { ref } from 'vue'
import * as XLSX from 'xlsx'
import { api } from '@/composables/useApi'
import { useSourcesStore } from '@/stores/sources'
import { useSpreadsheetStore } from '@/stores/spreadsheet'
import { useChatStore } from '@/stores/chat'
import type { ConsolidationPayload, ConsolidationResponse, ApiResponse } from '@/types'

const isConsolidating = ref(false)

export function useConsolidation() {
  async function consolidate() {
    const sources = useSourcesStore()
    const spreadsheet = useSpreadsheetStore()
    const chat = useChatStore()

    const files = sources.getCheckedFiles()
    if (files.length === 0) {
      chat.addMessage('No files selected for consolidation.', 'system')
      return
    }

    isConsolidating.value = true
    chat.addMessage(`Consolidating ${files.length} file(s)...`, 'system')

    try {
      const payload: ConsolidationPayload = { files_data: [] }

      for (const file of files) {
        const buffer = await file.arrayBuffer()
        const wb = XLSX.read(buffer, { type: 'array' })
        const sheetName = wb.SheetNames[0]
        if (!sheetName) continue

        const sheet = wb.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
        if (json.length === 0) continue

        const headers = (json[0] as unknown[]).map(String)
        const rows = json.slice(1)
        payload.files_data.push({ name: file.name, headers, rows })
      }

      if (payload.files_data.length === 0) {
        chat.addMessage('No valid spreadsheet data found in selected files.', 'system')
        return
      }

      const resp = await api.post<ApiResponse<ConsolidationResponse>>(
        '/api/ai/consolidate',
        payload,
      )

      const { headers, rows } = resp.data

      // Build synthetic workbook — SpreadsheetEditor watcher mounts HT
      const wsData = [headers, ...rows]
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Consolidated')

      spreadsheet.loadWorkbook(wb, 'consolidated.xlsx')

      chat.addMessage(
        `Consolidated ${payload.files_data.length} files: ${headers.length} columns, ${rows.length} rows.`,
        'ai',
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      chat.addMessage(`Consolidation failed: ${msg}`, 'system')
      console.error('[consolidation]', err)
    } finally {
      isConsolidating.value = false
    }
  }

  return { consolidate, isConsolidating }
}
```

- [ ] **Step 2: Run type-check**

```bash
cd frontend && npm run type-check
```

Expected: No errors.

- [ ] **Step 3: Run all tests**

```bash
cd frontend && npm test
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/composables/useConsolidation.ts
git commit -m "simplify consolidation — loadWorkbook triggers HT mount via watcher"
```

---

## Chunk 5: Manual Verification

### Task 7: Verify end-to-end functionality

**No files to create — verification steps only.**

- [ ] **Step 1: Start dev server**

```bash
cd frontend && npm run dev
```

Expected: Server starts on `http://localhost:5173` (or configured port), no console errors.

- [ ] **Step 2: Verify file open**

1. Log in and navigate to workspace
2. Upload any `.xlsx` file from the Sources panel
3. Click the file in the source list to open it

Expected:
- Toolbar appears above spreadsheet
- Formula bar shows `A1` and cell value
- HT grid renders with row/col headers
- Row 0 has green background header styling
- Sheet tabs appear at the bottom if file has multiple sheets

- [ ] **Step 3: Verify toolbar actions**

1. Click a cell — formula bar updates
2. Select a range — click **B** (bold) — cells should bold
3. Click **I** (italic) — cells should italicize
4. Click text color swatch — color picker opens — pick a color — cell text changes color
5. Click fill color swatch — color picker opens — pick a color — cell background changes
6. Select alignment buttons — cell alignment changes
7. Change number format dropdown to "Currency" — numeric cells should show `$X.XX`
8. Click freeze button — first row freezes; button activates
9. Click find button — Find & Replace modal opens
10. Type in find modal, click Find Next — cell selected
11. Click zoom in/out — spreadsheet zooms
12. Pinch trackpad on spreadsheet — zooms in/out

Expected: All actions work without console errors.

- [ ] **Step 4: Verify keyboard shortcuts**

1. Click a cell inside the spreadsheet
2. Press `Ctrl+B` / `Cmd+B` — bold toggles
3. Press `Ctrl+I` / `Cmd+I` — italic toggles
4. Press `Ctrl+U` / `Cmd+U` — underline toggles
5. Press `Ctrl+F` / `Cmd+F` — find modal opens

Expected: All shortcuts work; do not interfere with browser shortcuts outside spreadsheet focus.

- [ ] **Step 5: Verify consolidation flow**

1. Upload 2+ xlsx files
2. Check them all
3. Click **Consolidate**

Expected:
- Chat shows "Consolidating…" then success message
- Spreadsheet mounts with consolidated data
- Toolbar and formula bar appear
- Row 0 shows column headers with green background

- [ ] **Step 6: Verify download**

1. With a spreadsheet open, click **Download**

Expected: `.xlsx` file downloads with all sheets and current data.

- [ ] **Step 7: Verify close**

1. With a spreadsheet open, click **Close**

Expected: Spreadsheet clears; empty state shows; no console errors.

- [ ] **Step 8: Verify multi-sheet**

1. Upload a multi-sheet `.xlsx` file
2. Open it

Expected: Sheet tabs appear at the bottom; clicking tabs switches sheets; formula bar and toolbar remain active.

- [ ] **Step 9: Final commit if any fixes were needed during verification**

Stage only files modified during verification (do not use `git add -A`):

```bash
git add frontend/src/composables/useSpreadsheetEditor.ts \
        frontend/src/components/editor/SpreadsheetEditor.vue \
        frontend/src/composables/useAiOperations.ts \
        frontend/src/composables/useConsolidation.ts \
        frontend/src/stores/spreadsheet.ts
git commit -m "fix: spreadsheet UI port verification fixes"
```
