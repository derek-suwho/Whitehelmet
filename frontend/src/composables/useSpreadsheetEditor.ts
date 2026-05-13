import Handsontable from 'handsontable'
import { HyperFormula } from 'hyperformula'
import * as XLSX from 'xlsx'
import { ref } from 'vue'
import { useSpreadsheetStore } from '@/stores/spreadsheet'

// ── Module-level state (singleton — one editor in the app) ──────
let _currentSheetIdx = 0
let _allSheetFormats: Record<string, Record<string, any>>[] = []
let _allSheetMerges: any[][] = []
let _allSheetColWidths: number[][] = []
let _allSheetRowHeights: number[][] = []
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
/** Per-sheet tab fill from OOXML tabColor (same order as sheetNames); null = default gray. */
export const sheetTabColors = ref<(string | null)[]>([])
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
export const detectedFormulas = ref<{ column: string; expression: string }[]>([])
export const selectedCol = ref(0)

// ── Formula panel helpers (used by FormulaLibraryPanel) ─────────

/** Find the header row — the row with the most non-empty cells among the first 10 rows. */
export function detectHeaderRow(data: unknown[][]): number {
  const limit = Math.min(data.length, 10)
  let bestRow = 0
  let bestCount = 0
  for (let r = 0; r < limit; r++) {
    const row = data[r] as unknown[]
    const count = row.filter(c => c != null && String(c).trim() !== '').length
    if (count > bestCount) {
      bestCount = count
      bestRow = r
    }
  }
  return bestRow
}

export function getColumnHeadersExternal(): { idx: number; letter: string; name: string }[] {
  if (!_currentInstance) return []
  const data = _currentInstance.getData() as unknown[][]
  if (!data.length) return []
  const headerRowIdx = detectHeaderRow(data)
  const headers = (data[headerRowIdx] as unknown[]).map((c) => String(c ?? ''))
  return headers
    .map((name, idx) => ({ idx, letter: _colLetter(idx), name }))
    .filter((h) => h.name.trim())
}

export function applyFormulaToColumn(expression: string, colIdx: number): number {
  if (!_currentInstance) return 0
  const rowCount = Math.max(0, (_currentInstance.countRows?.() ?? 1) - 1)
  const changes: [number, number, string][] = []
  for (let d = 0; d < rowCount; d++) {
    changes.push([d + 1, colIdx, expression.replace(/\{row\}/gi, String(d + 2))])
  }
  if (changes.length) _currentInstance.setDataAtCell(changes)
  return rowCount
}

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

export function applyFmtExternal(row: number, col: number, props: Record<string, any>): void {
  const physRow = _currentInstance ? _currentInstance.toPhysicalRow(row) : row
  const physCol = _currentInstance ? _currentInstance.toPhysicalColumn(col) : col
  _setFmt(_currentSheetIdx, physRow, physCol, props)
}

export function clearFmtExternal(row: number, col: number): void {
  if (!_allSheetFormats[_currentSheetIdx]) return
  const physRow = _currentInstance ? _currentInstance.toPhysicalRow(row) : row
  const physCol = _currentInstance ? _currentInstance.toPhysicalColumn(col) : col
  delete _allSheetFormats[_currentSheetIdx][`${physRow},${physCol}`]
}

export function renderExternal(): void {
  _currentInstance?.render()
}

// ── Private helpers ──────────────────────────────────────────────

function _isDark(hex: string): boolean {
  const h = hex.replace('#', '')
  if (h.length < 6) return false
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.45
}

function _argbToCss(argb: string): string | null {
  if (!argb) return null
  const s = String(argb).replace('#', '')
  if (s.length === 8) return '#' + s.slice(2)
  if (s.length === 6) return '#' + s
  return null
}

// Standard Excel 64-color indexed palette
const _INDEXED_COLORS: string[] = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
  '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#C0C0C0', '#808080',
  '#9999FF', '#993366', '#FFFFCC', '#CCFFFF', '#660066', '#FF8080', '#0066CC', '#CCCCFF',
  '#000080', '#FF00FF', '#FFFF00', '#00FFFF', '#800080', '#800000', '#008080', '#0000FF',
  '#00CCFF', '#CCFFFF', '#CCFFCC', '#FFFF99', '#99CCFF', '#FF99CC', '#CC99FF', '#FFCC99',
  '#3366FF', '#33CCCC', '#99CC00', '#FFCC00', '#FF9900', '#FF6600', '#666699', '#969696',
  '#003366', '#339966', '#003300', '#333300', '#993300', '#993366', '#333399', '#333333',
]

// Default Office theme base colors (Office 2016 default)
const _THEME_COLORS: string[] = [
  '#000000', '#FFFFFF', '#44546A', '#E7E6E6',
  '#4472C4', '#ED7D31', '#A9D18E', '#FF0000',
  '#FFC000', '#70AD47', '#0563C1', '#954F72',
]

function _applyTint(hex: string, tint: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const apply = (c: number) => tint > 0 ? Math.round(c + (255 - c) * tint) : Math.round(c * (1 + tint))
  const clamp = (c: number) => Math.max(0, Math.min(255, c))
  return `#${clamp(apply(r)).toString(16).padStart(2, '0')}${clamp(apply(g)).toString(16).padStart(2, '0')}${clamp(apply(b)).toString(16).padStart(2, '0')}`
}

function _resolveXlsxColor(fgColor: any): string | null {
  if (!fgColor) return null
  if (fgColor.rgb) return _argbToCss(fgColor.rgb)
  if (typeof fgColor.indexed === 'number' && fgColor.indexed < _INDEXED_COLORS.length)
    return _INDEXED_COLORS[fgColor.indexed]
  if (typeof fgColor.theme === 'number') {
    const base = _THEME_COLORS[fgColor.theme]
    if (!base) return null
    const tint = typeof fgColor.tint === 'number' ? fgColor.tint : 0
    return tint !== 0 ? _applyTint(base, tint) : base
  }
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .apply(null as any, [hot, TD, row, col, prop, value, cellProps])

    const fmt = _getFmt(_currentSheetIdx, hot.toPhysicalRow(row), hot.toPhysicalColumn(col))
    // Header row defaults
    if (row === 0) {
      if (!fmt.bgColor) TD.style.backgroundColor = '#e9f0e9'
      if (!fmt.bold) TD.style.fontWeight = '600'
      if (!fmt.color) TD.style.color = '#111827'
    }
    if (fmt.bold) TD.style.fontWeight = 'bold'
    if (fmt.italic) TD.style.fontStyle = 'italic'
    if (fmt.underline) TD.style.textDecoration = 'underline'
    if (fmt.color) TD.style.color = fmt.color
    if (fmt.bgColor) {
      // Replace pure black fills with dark slate grey for readability
      const bg = fmt.bgColor.toUpperCase() === '#000000' ? '#374151' : fmt.bgColor
      TD.style.backgroundColor = bg
      // Auto-contrast: use white text on dark backgrounds when no explicit text color set
      if (!fmt.color && _isDark(bg)) TD.style.color = '#FFFFFF'
    }
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
    const physRow = _currentInstance ? _currentInstance.toPhysicalRow(row) : row
    const physCol = _currentInstance ? _currentInstance.toPhysicalColumn(col) : col
    const fmt = _getFmt(_currentSheetIdx, physRow, physCol)
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
        _setFmt(_currentSheetIdx, _currentInstance.toPhysicalRow(r), _currentInstance.toPhysicalColumn(c), props)
    _currentInstance.render()
    _updateToolbarState(rng.from.row, rng.from.col)
  }

  function _toggleFmt(key: string): void {
    const rng = _getRange()
    if (!rng || !_currentInstance) return
    const physRow = _currentInstance.toPhysicalRow(rng.from.row)
    const physCol = _currentInstance.toPhysicalColumn(rng.from.col)
    const current = _getFmt(_currentSheetIdx, physRow, physCol)[key]
    _applyFmt({ [key]: !current })
  }

  // Returns the right display value for a numeric XLSX cell.
  // Comma-formatted numbers ("125,000") → raw numeric so HyperFormula SUM works.
  // Everything else (dates "10/30/2025", custom formats) → display string.
  function _displayVal(cell: any): any {
    const v = cell.v
    const w = typeof cell.w === 'string' ? cell.w.trim() : cell.w
    if (v === undefined || v === null) return ''
    if (!w) return v
    if (/^-?[\d,]+(\.\d+)?$/.test(w)) return v   // plain/comma number → raw value
    return w                                        // date or other format → display string
  }

  // Resolve a simple cross-sheet reference by looking up the cell directly in wb.
  // Handles both 'Sheet Name'!D4 and SheetName!D4 syntax.
  // Returns the resolved display value, or null if the ref can't be resolved.
  function _resolveXSheet(formula: string, wb: any): any {
    const m = formula.match(/^'?([^'!]+)'?!([A-Z]+\d+)$/i)
    if (!m) return null
    const ws = wb.Sheets?.[m[1]]
    if (!ws) return null
    const cell = ws[m[2]]
    if (!cell) return ''
    return _displayVal(cell)
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
    _allSheetRowHeights = []
    _sheetsData = []
    _sheetNames = wb.SheetNames.slice()
    _zoomLevel = 1.0
    zoomLevel.value = 1.0
    detectedFormulas.value = []

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

      // Data rows — formula strings first, then raw number (avoids comma-formatted
      // strings like "125,000" that HyperFormula can't sum), then display value
      const processed: any[][] = []
      for (let R = 0; R < maxRows; R++) {
        const row: any[] = []
        for (let C = 0; C < maxCols; C++) {
          const addr = XLSX.utils.encode_cell({ r: R, c: C })
          const cell = ws[addr]
          if (!cell) { row.push(''); continue }
          let val: any
          if (cell.f) {
            // Cross-sheet refs: resolve directly from the workbook so we get the
            // live cell value (not a stale cached v:0 from template creation time).
            if (cell.f.includes('!')) {
              const resolved = _resolveXSheet(cell.f, wb)
              val = resolved !== null ? resolved : _displayVal(cell)
            } else {
              val = `=${cell.f}`
            }
          } else if (cell.t === 'n' && cell.v !== undefined && cell.v !== null) {
            val = _displayVal(cell)
          } else if (cell.w !== undefined && cell.w !== '') {
            val = cell.w
          } else {
            val = cell.v !== undefined && cell.v !== null ? cell.v : ''
          }
          row.push(val)
        }
        processed.push(row)
      }
      while (processed.length < 50) processed.push(new Array(maxCols).fill(''))
      _sheetsData.push(processed)

      // Collect formulas found in this sheet (first sheet only, skip header row)
      if (sheetIdx === 0 && processed.length > 0) {
        const headers = processed[0]
        const found: { column: string; expression: string }[] = []
        const seen = new Set<string>()
        for (let DC = 0; DC < maxCols; DC++) {
          for (let DR = 1; DR < processed.length; DR++) {
            const v = String(processed[DR][DC] ?? '')
            if (v.startsWith('=') && !seen.has(v)) {
              seen.add(v)
              found.push({ column: String(headers[DC] ?? `Col ${DC + 1}`), expression: v })
              break
            }
          }
        }
        if (found.length) detectedFormulas.value = found
      }

      // Cell styles
      const fmts: Record<string, Record<string, any>> = {}
      for (let SR = 0; SR <= range.e.r; SR++) {
        for (let SC = 0; SC <= range.e.c; SC++) {
          const addr = XLSX.utils.encode_cell({ r: SR, c: SC })
          const scell = ws[addr]
          if (!scell?.s) continue
          const s = scell.s
          const fmt: Record<string, any> = {}
          // XLSX.js flattens font props directly onto s (not s.font)
          if (s.bold) fmt.bold = true
          if (s.italic) fmt.italic = true
          if (s.underline) fmt.underline = true
          const fc = _resolveXlsxColor(s.color)
          if (fc && fc.toUpperCase() !== '#000000') fmt.color = fc
          // Fill: fgColor is flat on s (not s.fill.fgColor)
          if (s.patternType === 'solid') {
            const bg = _resolveXlsxColor(s.fgColor)
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

      // Row heights
      const rowDefs = ws['!rows'] || []
      const heights: number[] = []
      for (let RH = 0; RH < Math.max(maxRows, 50); RH++) {
        const ri = rowDefs[RH]
        if (ri?.hpx) heights.push(Math.max(18, ri.hpx))
        else if (ri?.hpt) heights.push(Math.max(18, Math.round(ri.hpt * 1.33)))
        else heights.push(23)
      }
      _allSheetRowHeights.push(heights)
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
      height: container.offsetHeight > 0 ? container.offsetHeight : '100%',
      licenseKey: 'non-commercial-and-evaluation',
      theme: 'ht-theme-main',
      formulas: { engine: HyperFormula, licenseKey: 'non-commercial-and-evaluation' } as any,
      colWidths: _allSheetColWidths[0] ?? 100,
      rowHeights: _allSheetRowHeights[0] ?? 23,
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
        selectedCol.value = col
      },
      beforeChange(changes: any) {
        if (!changes) return
        for (const change of changes) {
          const newVal = change[3]
          if (typeof newVal === 'string' && newVal.includes(',')) {
            const stripped = newVal.replace(/,/g, '')
            const asNum = Number(stripped)
            if (!isNaN(asNum) && stripped !== '') change[3] = asNum
          }
        }
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
    sheetTabColors.value = []
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
      rowHeights: _allSheetRowHeights[idx] ?? 23,
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
      case 'undo':         (_currentInstance!.getPlugin('undoRedo') as any).undo(); break
      case 'redo':         (_currentInstance!.getPlugin('undoRedo') as any).redo(); break
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
      // Convert formula strings to XLSX formula cell objects so Excel evaluates them
      Object.keys(ws)
        .filter((k) => !k.startsWith('!'))
        .forEach((addr) => {
          const cell = ws[addr]
          if (cell && typeof cell.v === 'string' && cell.v.startsWith('=')) {
            cell.f = cell.v.slice(1)
            delete cell.v
            delete cell.w
            delete cell.t
          }
        })
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
