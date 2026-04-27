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
export const detectedFormulas = ref<{ column: string; expression: string }[]>([])

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .apply(null as any, [hot, TD, row, col, prop, value, cellProps])

    const fmt = _getFmt(_currentSheetIdx, hot.toPhysicalRow(row), hot.toPhysicalColumn(col))
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

      // Data rows — prefer formula strings, then display value, then raw value
      const processed: any[][] = []
      for (let R = 0; R < maxRows; R++) {
        const row: any[] = []
        for (let C = 0; C < maxCols; C++) {
          const addr = XLSX.utils.encode_cell({ r: R, c: C })
          const cell = ws[addr]
          if (!cell) { row.push(''); continue }
          const val = cell.f
            ? `=${cell.f}`
            : cell.w !== undefined && cell.w !== ''
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
      formulas: { engine: HyperFormula, licenseKey: 'non-commercial-and-evaluation' },
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
            cell.t = 'n'
            delete cell.v
            delete cell.w
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
