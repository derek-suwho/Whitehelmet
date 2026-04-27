import * as XLSX from 'xlsx'
import { useRouter } from 'vue-router'
import { api } from '@/composables/useApi'
import { useSpreadsheetStore } from '@/stores/spreadsheet'
import { useSourcesStore } from '@/stores/sources'
import { useRecordsStore } from '@/stores/records'
import { useChatStore } from '@/stores/chat'
import { useFormulasStore } from '@/stores/formulas'
import { applyFmtExternal, clearFmtExternal, renderExternal } from '@/composables/useSpreadsheetEditor'
import type { CommandApiResponse } from '@/types'

// ── Module-level filter state ─────────────────────────────────────────────────
// Tracks which rows are CSS-hidden by the filter op so show_all_rows can restore them.
const hiddenRows = new Set<number>()

// ── Helpers ───────────────────────────────────────────────────────────────────

function getColumnHeaders(hot: any): string[] {
  const data: unknown[][] = hot.getData?.() ?? []
  if (!data.length) return []
  return (data[0] as unknown[]).map((c) => String(c ?? ''))
}

function getDataRows(hot: any): unknown[][] {
  const data: unknown[][] = hot.getData?.() ?? []
  return data.slice(1)
}

function getRowCount(hot: any): number {
  return Math.max(0, (hot.countRows?.() ?? 1) - 1)
}

function getColCount(hot: any): number {
  return hot.countCols?.() ?? 0
}

function resolveColumnIndex(headers: string[], column: string | number): number {
  if (typeof column === 'number') return column
  const lower = column.toLowerCase()
  return headers.findIndex((h) => h.toLowerCase() === lower)
}

function colLetter(idx: number): string {
  return String.fromCharCode(65 + idx)
}

function cellName(col: number, row: number): string {
  return `${colLetter(col)}${row + 1}`
}

function buildStyle(props: Record<string, unknown>): string {
  const styles: string[] = []
  if (props.bold) styles.push('font-weight: bold')
  if (props.italic) styles.push('font-style: italic')
  if (props.color) styles.push(`color: ${props.color}`)
  if (props.bgColor) styles.push(`background-color: ${props.bgColor}`)
  if (props.align) styles.push(`text-align: ${props.align}`)
  return styles.join('; ')
}

function evaluateCondition(cellVal: unknown, operator: string, value: string): boolean {
  const numCell = parseFloat(String(cellVal))
  const numVal = parseFloat(value)
  const bothNumeric = !isNaN(numCell) && !isNaN(numVal)
  switch (operator) {
    case '>': return bothNumeric && numCell > numVal
    case '<': return bothNumeric && numCell < numVal
    case '>=': return bothNumeric && numCell >= numVal
    case '<=': return bothNumeric && numCell <= numVal
    case '=': return String(cellVal) === value
    case '!=': return String(cellVal) !== value
    case 'contains': return String(cellVal).toLowerCase().includes(value.toLowerCase())
    default: return false
  }
}

function buildSnapshot(jss: any): string {
  const headers = getColumnHeaders(jss)
  const data = getDataRows(jss)
  const cap = 100
  const rows = data.slice(0, cap)
  const truncated = data.length > cap
  const lines: string[] = [
    `Spreadsheet (${data.length} row${data.length !== 1 ? 's' : ''}${truncated ? `, showing first ${cap}` : ''}):`,
    headers.join('\t'),
  ]
  for (const row of rows) {
    lines.push((row as unknown[]).map((c) => String(c ?? '').slice(0, 80)).join('\t'))
  }
  return lines.join('\n')
}

async function buildSourceSnapshot(): Promise<string | null> {
  const sources = useSourcesStore()
  const files = sources.getCheckedFiles()
  if (!files.length) return null

  const infos = await Promise.all(
    files.map(async (file) => {
      try {
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
        const headers = ((aoa[0] ?? []) as unknown[]).map(String).filter((h) => h.trim())
        const sampleRows = aoa.slice(1, 6)
        return { name: file.name, headers, sampleRows }
      } catch {
        return { name: file.name, headers: [], sampleRows: [] }
      }
    }),
  )

  const lines = [`Selected sources (${infos.length}):`]
  for (const info of infos) {
    lines.push(`\nFile: ${info.name}`)
    if (!info.headers.length) { lines.push('  (no headers found)'); continue }
    lines.push(`  Columns: ${info.headers.join(', ')}`)
    if (info.sampleRows.length) {
      lines.push('  Sample:')
      for (const row of info.sampleRows) {
        const cells = info.headers.map(
          (h, i) => `${h}: ${String((row as unknown[])[i] ?? '').slice(0, 60)}`,
        )
        lines.push(`    { ${cells.join(', ')} }`)
      }
    }
  }
  return lines.join('\n')
}

async function detectLayout(aoa: unknown[][]): Promise<{
  orientation: 'vertical' | 'horizontal'
  headerRow?: number
  dataStartRow?: number
  headerCol?: number
  dataStartCol?: number
}> {
  const sample = aoa
    .slice(0, 15)
    .map((row) => (row as unknown[]).slice(0, 15).map((c) => String(c ?? '')).join('\t'))
    .join('\n')

  const resp = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'anthropic/claude-opus-4-5',
      max_tokens: 64,
      stream: false,
      messages: [
        { role: 'system', content: 'Return ONLY JSON describing table layout. No markdown.' },
        {
          role: 'user',
          content:
            `Grid sample (TSV):\n${sample}\n\nReturn: ` +
            `{"orientation":"vertical","header_row":<0-based>,"data_start_row":<0-based>} ` +
            `or {"orientation":"horizontal","header_col":<0-based>,"data_start_col":<0-based>}`,
        },
      ],
    }),
  })
  const json = await resp.json()
  const text: string = json.choices[0].message.content
    .trim()
    .replace(/^```[\w]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim()
  const parsed = JSON.parse(text)
  return {
    orientation: parsed.orientation,
    headerRow: parsed.header_row,
    dataStartRow: parsed.data_start_row,
    headerCol: parsed.header_col,
    dataStartCol: parsed.data_start_col,
  }
}

async function mapColumns(
  templateCols: string[],
  sourceCols: string[],
): Promise<Record<string, string | null>> {
  const resp = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'anthropic/claude-opus-4-5',
      max_tokens: 256,
      stream: false,
      messages: [
        {
          role: 'system',
          content:
            'Return ONLY a JSON object. Keys are template column names, values are best-matching source column name or null.',
        },
        {
          role: 'user',
          content: `Template columns: ${JSON.stringify(templateCols)}\nSource columns: ${JSON.stringify(sourceCols)}`,
        },
      ],
    }),
  })
  const json = await resp.json()
  const text: string = json.choices[0].message.content
    .trim()
    .replace(/^```[\w]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim()
  return JSON.parse(text)
}

async function parseSourceFile(file: File): Promise<{ headers: string[]; dataRows: unknown[][] }> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', blankrows: false })

  const layout = await detectLayout(aoa as unknown[][])

  let headers: string[]
  let dataRows: unknown[][]

  if (layout.orientation === 'horizontal') {
    const hCol = layout.headerCol ?? 0
    const dCol = layout.dataStartCol ?? 1
    headers = aoa.map((row) => String((row as unknown[])[hCol] ?? ''))
    const raw = aoa.map((row) => (row as unknown[]).slice(dCol))
    dataRows = raw.length && raw[0].length
      ? raw[0].map((_, ci) => raw.map((row) => row[ci] ?? ''))
      : []
  } else {
    const hRow = layout.headerRow ?? 0
    const dRow = layout.dataStartRow ?? 1
    headers = ((aoa[hRow] ?? []) as unknown[]).map((h) => String(h ?? ''))
    dataRows = aoa.slice(dRow) as unknown[][]
  }

  return { headers, dataRows }
}

// ── Keyword matchers ──────────────────────────────────────────────────────────

const SUGGEST_RE = /suggest.*(template|column)|what column|recommend.*column/i
const CONSOLIDATE_RE = /fill.*(template|from source)|populate.*template|consolidate.*into.*template|map.*source.*template|fill it/i
const DYNAMIC_RE = /create.*report|build.*report|make.*report|generate.*report|create.*tracker|analyze.*source|give.*analysis/i
const NEW_TEMPLATE_RE = /new\s+template|create\s+(a\s+)?template|blank\s+sheet|start\s+(a\s+)?fresh/i
const FORMULA_CREATE_RE = /create.*(formula|calculation)|make.*(formula|calculation)|formula\s+for|generate.*formula|build.*formula/i

// ── Multi-step ops ────────────────────────────────────────────────────────────

async function executeSuggestTemplate(jss: any, chat: ReturnType<typeof useChatStore>): Promise<void> {
  chat.addMessage('Analyzing columns and source files…', 'ai')
  const snapshot = buildSnapshot(jss)
  const sourceSnap = await buildSourceSnapshot()

  let userContent = ''
  if (sourceSnap) userContent += sourceSnap + '\n\n'
  userContent += `Current columns: ${JSON.stringify(getColumnHeaders(jss))}`
  userContent += `\n\nGrid sample:\n${snapshot.split('\n').slice(0, 6).join('\n')}`
  userContent += '\n\nRecommend a standard column schema. Format as:\n**Keep:** [...]\n**Rename:** [old → new]\n**Add:** [...]\n**Remove:** [...]'

  const resp = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'anthropic/claude-opus-4-5',
      max_tokens: 1024,
      stream: false,
      messages: [
        {
          role: 'system',
          content: 'You are a QHSE project management expert. Analyze spreadsheet columns and recommend a standardized master record schema. Be concise and actionable.',
        },
        { role: 'user', content: userContent },
      ],
    }),
  })
  const json = await resp.json()
  const result: string = json.choices[0].message.content
  const msgs = chat.messages
  const lastAi = [...msgs].reverse().find((m) => m.role === 'ai')
  if (lastAi) lastAi.content = result
}

async function executeConsolidateToTemplate(
  jss: any,
  chat: ReturnType<typeof useChatStore>,
  userText: string,
): Promise<void> {
  const sources = useSourcesStore()
  const files = sources.getCheckedFiles()
  if (!files.length) {
    chat.addMessage('No source files selected. Check boxes in the left panel.', 'system')
    return
  }

  let templateHeaders = getColumnHeaders(jss).filter((h) => h.trim())

  if (!templateHeaders.length) {
    chat.addMessage('Generating template headers from source files…', 'ai')
    const sourceSnap = await buildSourceSnapshot()
    const hResp = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'anthropic/claude-opus-4-5',
        max_tokens: 256,
        stream: false,
        messages: [
          {
            role: 'system',
            content: 'You are a QHSE expert. Return ONLY a JSON array of column header strings — no other text, no markdown.',
          },
          {
            role: 'user',
            content: (sourceSnap ?? '') + `\n\nUser request: ${userText}\n\nDesign a master template column list (8-14 columns) tailored to this request.`,
          },
        ],
      }),
    })
    const hJson = await hResp.json()
    const hText: string = hJson.choices[0].message.content
      .trim().replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim()
    templateHeaders = JSON.parse(hText)
    jss.setDataAtCell(templateHeaders.map((h: string, i: number) => [0, i, h] as [number, number, string]))
  }

  const outputRows: unknown[][] = []
  const n = files.length

  for (let i = 0; i < n; i++) {
    const file = files[i]
    const lastAi = [...chat.messages].reverse().find((m) => m.role === 'ai')
    if (lastAi) lastAi.content = `Mapping file ${i + 1} of ${n}: ${file.name}…`

    const { headers: srcHeaders, dataRows: srcData } = await parseSourceFile(file)
    const mapping = await mapColumns(templateHeaders, srcHeaders)

    for (const row of srcData) {
      const isEmpty = (row as unknown[]).every((c) => c === '' || c === null || c === undefined)
      if (isEmpty) continue
      const mapped = templateHeaders.map((col) => {
        const srcCol = mapping[col]
        if (!srcCol) return ''
        const idx = srcHeaders.indexOf(srcCol)
        return idx >= 0 ? (row as unknown[])[idx] ?? '' : ''
      })
      outputRows.push(mapped)
    }
  }

  jss.loadData([templateHeaders, ...outputRows] as any)
  const lastAi = [...chat.messages].reverse().find((m) => m.role === 'ai')
  if (lastAi) lastAi.content = `Filled template with ${outputRows.length} row(s) from ${n} file(s).`
}

async function executeDynamicReport(
  jss: any,
  chat: ReturnType<typeof useChatStore>,
  userText: string,
): Promise<void> {
  chat.addMessage('Planning report structure…', 'ai')
  const sourceSnap = await buildSourceSnapshot()

  const planResp = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'anthropic/claude-opus-4-5',
      max_tokens: 1024,
      stream: false,
      messages: [
        {
          role: 'system',
          content: 'You are a QHSE data analyst. Return ONLY JSON: {"title":"...","columns":[{"name":"...","source_field":"<exact source col or null>","type":"text|number|date|currency|percent"}]}. Design 6-16 columns specific to the request.',
        },
        {
          role: 'user',
          content: (sourceSnap ? sourceSnap + '\n\n' : '') + 'User request: ' + userText,
        },
      ],
    }),
  })
  const planJson = await planResp.json()
  const planText: string = planJson.choices[0].message.content
    .trim().replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim()
  const plan = JSON.parse(planText) as { title: string; columns: { name: string; source_field: string | null }[] }
  const templateHeaders = plan.columns.map((c) => c.name)

  if (!templateHeaders.length) {
    const lastAi = [...chat.messages].reverse().find((m) => m.role === 'ai')
    if (lastAi) lastAi.content = 'Could not design report columns. Try a more specific request.'
    return
  }

  jss.loadData([templateHeaders] as any)

  const sources = useSourcesStore()
  const files = sources.getCheckedFiles()
  if (!files.length) {
    const lastAi = [...chat.messages].reverse().find((m) => m.role === 'ai')
    if (lastAi) lastAi.content = `"${plan.title}" headers set (${templateHeaders.length} columns). Select source files and run again to fill data.`
    return
  }

  const templateColsWithHints = plan.columns.map(
    (c) => c.name + (c.source_field ? ` [hint: "${c.source_field}"]` : ''),
  )
  // mapColumns keys are hint-suffixed; build lookup so data rows can find results by plain name
  const hintedKey: Record<string, string> = {}
  for (let ci = 0; ci < plan.columns.length; ci++) {
    hintedKey[plan.columns[ci].name] = templateColsWithHints[ci]
  }
  const outputRows: unknown[][] = []
  const n = files.length

  for (let i = 0; i < n; i++) {
    const file = files[i]
    const lastAi = [...chat.messages].reverse().find((m) => m.role === 'ai')
    if (lastAi) lastAi.content = `Building report — file ${i + 1} of ${n}: ${file.name}…`

    const { headers: srcHeaders, dataRows: srcData } = await parseSourceFile(file)
    const mapping = await mapColumns(templateColsWithHints, srcHeaders)

    for (const row of srcData) {
      const isEmpty = (row as unknown[]).every((c) => c === '' || c === null || c === undefined)
      if (isEmpty) continue
      const mapped = templateHeaders.map((col) => {
        const srcCol = mapping[hintedKey[col] ?? col]
        if (!srcCol) return ''
        const idx = srcHeaders.indexOf(srcCol)
        return idx >= 0 ? (row as unknown[])[idx] ?? '' : ''
      })
      outputRows.push(mapped)
    }
  }

  jss.loadData([templateHeaders, ...outputRows] as any)
  const lastAi = [...chat.messages].reverse().find((m) => m.role === 'ai')
  if (lastAi) lastAi.content = `"${plan.title}" built with ${outputRows.length} row(s) from ${n} file(s).`
}

// ── Op executor ───────────────────────────────────────────────────────────────

async function applyOperation(
  jss: any,
  op: string,
  p: Record<string, unknown>,
  chat: ReturnType<typeof useChatStore>,
  router: ReturnType<typeof useRouter>,
): Promise<string> {
  const headers = getColumnHeaders(jss)

  function resolveCol(col: unknown): number {
    return resolveColumnIndex(headers, col as string | number)
  }

  switch (op) {
    case 'add_column': {
      const pos = p.position != null ? Number(p.position) : getColCount(jss)
      const title = String(p.name ?? 'New Column')
      jss.alter('insert_col_start', pos, 1)
      jss.setDataAtCell(0, pos, title)
      if (p.default_value) {
        const rowCount = getRowCount(jss)
        const changes: [number, number, string][] = []
        for (let d = 0; d < rowCount; d++) {
          changes.push([d + 1, pos, p.default_value as string])
        }
        if (changes.length) jss.setDataAtCell(changes)
      }
      return `Added column "${title}".`
    }

    case 'remove_column': {
      const idx = resolveCol(p.name)
      if (idx === -1) return `Column "${p.name}" not found.`
      jss.alter('remove_col', idx, 1)
      return `Removed column "${p.name}".`
    }

    case 'rename_column': {
      const idx = resolveCol(p.from)
      if (idx === -1) return `Column "${p.from}" not found.`
      jss.setDataAtCell(0, idx, String(p.to ?? ''))
      return `Renamed "${p.from}" → "${p.to}".`
    }

    case 'apply_formula': {
      const idx = resolveCol(p.column)
      if (idx === -1) return `Column "${p.column}" not found.`
      const formula = String(p.formula ?? '')
      const rowCount = getRowCount(jss)
      const changes: [number, number, string][] = []
      for (let d = 0; d < rowCount; d++) {
        changes.push([d + 1, idx, formula.replace(/\{row\}/gi, String(d + 2))])
      }
      if (changes.length) jss.setDataAtCell(changes)
      return `Applied formula to "${p.column}" (${rowCount} rows).`
    }

    case 'apply_saved_formula': {
      const formulaStore = useFormulasStore()
      const saved = formulaStore.findByName(String(p.formula_name ?? ''))
      if (!saved) return `Formula "${p.formula_name}" not found in library.`
      const idx = resolveCol(p.column)
      if (idx === -1) return `Column "${p.column}" not found.`
      const rowCount = getRowCount(jss)
      const changes: [number, number, string][] = []
      for (let d = 0; d < rowCount; d++) {
        changes.push([d + 1, idx, saved.expression.replace(/\{row\}/gi, String(d + 2))])
      }
      if (changes.length) jss.setDataAtCell(changes)
      return `Applied "${saved.name}" to "${p.column}" (${rowCount} rows).`
    }

    case 'create_formula': {
      const formulaStore = useFormulasStore()
      const saved = await formulaStore.createFromNL(
        String(p.nl_request ?? ''),
        getColumnHeaders(jss),
      )
      if (p.column) {
        const idx = resolveCol(p.column)
        if (idx !== -1) {
          const rowCount = getRowCount(jss)
          const changes: [number, number, string][] = []
          for (let d = 0; d < rowCount; d++) {
            changes.push([d + 1, idx, saved.expression.replace(/\{row\}/gi, String(d + 2))])
          }
          if (changes.length) jss.setDataAtCell(changes)
          return `Created and applied "${saved.name}" (${saved.expression}) to "${p.column}".`
        }
      }
      return `Created formula "${saved.name}": ${saved.expression} — saved to library.`
    }

    case 'sort': {
      const idx = resolveCol(p.column)
      if (idx === -1) return `Column "${p.column}" not found.`
      const asc = String(p.order ?? 'asc') === 'asc'
      const sortPlugin = (jss as any).getPlugin('columnSorting')
      if (!sortPlugin) return 'Sort unavailable.'
      sortPlugin.sort({ column: idx, sortOrder: asc ? 'asc' : 'desc' })
      return `Sorted by "${p.column}" (${asc ? 'ascending' : 'descending'}).`
    }

    case 'filter': {
      const colIdx = resolveCol(p.column)
      if (colIdx === -1) return `Column "${p.column}" not found.`
      const data = getDataRows(jss)
      const operator = String(p.operator ?? '=')
      const value = String(p.value ?? '')
      const rowsToHide: number[] = []
      for (let d = 0; d < data.length; d++) {
        const cellVal = (data[d] as unknown[])[colIdx]
        if (!evaluateCondition(cellVal, operator, value)) {
          const physicalRow = jss.toPhysicalRow(d + 1)
          rowsToHide.push(physicalRow)
          hiddenRows.add(physicalRow)
        }
      }
      const hiddenPlugin = (jss as any).getPlugin('hiddenRows')
      if (hiddenPlugin && rowsToHide.length) {
        hiddenPlugin.hideRows(rowsToHide)
        jss.render()
      }
      return `Filtered: hiding ${rowsToHide.length} rows where "${p.column}" ${operator} ${value}.`
    }

    case 'show_all_rows': {
      const hiddenPlugin = (jss as any).getPlugin('hiddenRows')
      if (hiddenPlugin) {
        const currentlyHidden: number[] = hiddenPlugin.getHiddenRows()
        if (currentlyHidden.length) {
          hiddenPlugin.showRows(currentlyHidden)
          jss.render()
        }
      }
      hiddenRows.clear()
      return 'Showing all rows — filter cleared.'
    }

    case 'add_row': {
      const count = Number(p.count ?? 1)
      const pos = p.position != null ? Number(p.position) + 1 : jss.countRows() - 1
      jss.alter('insert_row_below', pos, count)
      return `Inserted ${count} row(s).`
    }

    case 'remove_empty_rows': {
      const data: unknown[][] = jss.getData()
      let deleted = 0
      for (let r = data.length - 1; r >= 1; r--) {
        const isEmpty = (data[r] as unknown[]).every(
          (c) => c === '' || c === null || c === undefined,
        )
        if (isEmpty) {
          jss.alter('remove_row', r, 1)
          deleted++
        }
      }
      return `Removed ${deleted} empty row(s).`
    }

    case 'aggregate': {
      const colIdx = resolveCol(p.column)
      if (colIdx === -1) return `Column "${p.column}" not found.`
      const data = getDataRows(jss)
      const values = data
        .map((row) => parseFloat(String((row as unknown[])[colIdx] ?? '')))
        .filter((v) => !isNaN(v))
      const func = String(p.func ?? 'sum')
      if (!values.length) return `No numeric values found in "${p.column}".`
      let result: number
      switch (func) {
        case 'sum': result = values.reduce((a, b) => a + b, 0); break
        case 'average': result = values.reduce((a, b) => a + b, 0) / values.length; break
        case 'count': return `Count of numeric values in "${p.column}": ${values.length}`
        case 'min': result = Math.min(...values); break
        case 'max': result = Math.max(...values); break
        default: return `Unknown function "${func}".`
      }
      return `${func.charAt(0).toUpperCase() + func.slice(1)} of "${p.column}": ${func === 'average' ? result.toFixed(2) : result}`
    }

    case 'find_duplicates': {
      const colIdx = resolveCol(p.column)
      if (colIdx === -1) return `Column "${p.column}" not found.`
      const data = getDataRows(jss)
      const seen: Record<string, number[]> = {}
      for (let r = 0; r < data.length; r++) {
        const val = String((data[r] as unknown[])[colIdx] ?? '').trim()
        if (!val) continue
        ;(seen[val] ??= []).push(r + 1)
      }
      const dupes = Object.entries(seen)
        .filter(([, rows]) => rows.length > 1)
        .map(([val, rows]) => `"${val}" (rows ${rows.join(', ')})`)
      if (!dupes.length) return `No duplicates found in "${p.column}".`
      return `Duplicates in "${p.column}":\n${dupes.join('\n')}`
    }

    case 'format_cells': {
      const props = (p.props ?? {}) as Record<string, any>
      const colIdx = p.column != null ? resolveCol(p.column) : null
      const targetRow = p.row != null ? Number(p.row) : null
      const data: unknown[][] = jss.getData()
      const rows = targetRow != null
        ? [targetRow]
        : Array.from({ length: data.length }, (_, i) => i)
      const cols = colIdx != null
        ? [colIdx]
        : Array.from({ length: getColCount(jss) }, (_, i) => i)
      for (const r of rows) {
        for (const c of cols) {
          applyFmtExternal(r, c, props)
        }
      }
      renderExternal()
      return `Formatted ${p.column ? `"${p.column}"` : 'selection'}.`
    }

    case 'highlight_column': {
      const colIdx = resolveCol(p.column)
      if (colIdx === -1) return `Column "${p.column}" not found.`
      const data: unknown[][] = jss.getData()
      for (let r = 0; r < data.length; r++) {
        applyFmtExternal(r, colIdx, { bgColor: String(p.bgColor) })
      }
      renderExternal()
      return `Highlighted "${p.column}" with ${p.bgColor}.`
    }

    case 'conditional_format': {
      const colIdx = resolveCol(p.column)
      if (colIdx === -1) return `Column "${p.column}" not found.`
      const data = getDataRows(jss)
      const props = (p.props ?? {}) as Record<string, any>
      const operator = String(p.operator ?? '=')
      const value = String(p.value ?? '')
      let matched = 0
      for (let d = 0; d < data.length; d++) {
        if (evaluateCondition((data[d] as unknown[])[colIdx], operator, value)) {
          for (let c = 0; c < getColCount(jss); c++) {
            applyFmtExternal(d + 1, c, props)
          }
          matched++
        }
      }
      renderExternal()
      return `Conditional format applied to ${matched} row(s) where "${p.column}" ${operator} ${value}.`
    }

    case 'clear_format': {
      const colIdx = p.column != null ? resolveCol(p.column) : null
      const data: unknown[][] = jss.getData()
      const cols = colIdx != null
        ? [colIdx]
        : Array.from({ length: getColCount(jss) }, (_, i) => i)
      for (let r = 0; r < data.length; r++) {
        for (const c of cols) {
          clearFmtExternal(r, c)
        }
      }
      renderExternal()
      return `Cleared formatting from ${p.column ? `"${p.column}"` : 'entire sheet'}.`
    }

    case 'export': {
      const spreadsheet = useSpreadsheetStore()
      const allData: unknown[][] = jss.getData()
      const wb2 = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet(allData as any[][])
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
      XLSX.utils.book_append_sheet(wb2, ws, 'Sheet1')
      XLSX.writeFile(wb2, `${spreadsheet.fileName ?? 'export'}.xlsx`)
      return 'Downloading spreadsheet as .xlsx…'
    }

    case 'save_record': {
      const spreadsheet = useSpreadsheetStore()
      const records = useRecordsStore()
      const allData: unknown[][] = jss.getData()
      const saveHeaders = (allData[0] as unknown[]).map((c) => String(c ?? ''))
      const data = allData.slice(1) as unknown[][]
      const date = new Date().toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
      const name = `${spreadsheet.fileName ?? 'Record'} — ${date}`
      await records.createRecord({ name, headers: saveHeaders, rows: data })
      return `Saved "${name}" to master records.`
    }

    case 'show_dashboard': {
      await router.push({ name: 'dashboard' })
      return 'Opening master records…'
    }

    default:
      return `Unknown operation: ${op}`
  }
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useAiOperations() {
  // Called synchronously in setup context — captured for use inside async handleCommand
  const router = useRouter()

  async function handleCommand(text: string): Promise<boolean> {
    const chat = useChatStore()
    const spreadsheet = useSpreadsheetStore()
    const jss = spreadsheet.instance

    // ── Keyword shortcuts (bypass /api/ai/command) ──
    if (NEW_TEMPLATE_RE.test(text)) {
      chat.addMessage('Use the "New" button in the editor panel to create a blank template.', 'ai')
      return true
    }

    if (!jss) return false

    if (SUGGEST_RE.test(text)) {
      await executeSuggestTemplate(jss, chat)
      return true
    }
    if (CONSOLIDATE_RE.test(text)) {
      await executeConsolidateToTemplate(jss, chat, text)
      return true
    }
    if (DYNAMIC_RE.test(text)) {
      await executeDynamicReport(jss, chat, text)
      return true
    }
    if (FORMULA_CREATE_RE.test(text)) {
      chat.addMessage('Creating formula…', 'ai')
      try {
        const formulaStore = useFormulasStore()
        const saved = await formulaStore.createFromNL(text, getColumnHeaders(jss))
        const lastAi = [...chat.messages].reverse().find((m) => m.role === 'ai')
        if (lastAi) lastAi.content = `Created formula "${saved.name}": \`${saved.expression}\` — saved to library.`
      } catch (err) {
        const lastAi = [...chat.messages].reverse().find((m) => m.role === 'ai')
        const msg = err instanceof Error ? err.message : String(err)
        if (lastAi) lastAi.content = `Error creating formula: ${msg}`
      }
      return true
    }

    // ── Generic command via /api/ai/command ──
    const snapshot = buildSnapshot(jss)
    const currentHeaders = getColumnHeaders(jss)

    // Append saved formula library to snapshot so AI can reference named formulas
    const formulaStore = useFormulasStore()
    const formulaContext = formulaStore.formulas.length
      ? '\n\nSaved formula library:\n' +
        formulaStore.formulas.map((f) => `- "${f.name}": ${f.expression}`).join('\n')
      : ''

    const resp = await api.post<CommandApiResponse>('/api/ai/command', {
      message: text,
      headers: currentHeaders,
      snapshot: snapshot + formulaContext,
    })

    if (!resp.op) return false

    chat.addMessage('Working…', 'ai')

    try {
      const result = await applyOperation(jss, resp.op, resp.params, chat, router)
      const lastAi = [...chat.messages].reverse().find((m) => m.role === 'ai')
      if (lastAi) lastAi.content = result
      return true
    } catch (err) {
      const lastAi = [...chat.messages].reverse().find((m) => m.role === 'ai')
      const msg = err instanceof Error ? err.message : String(err)
      if (lastAi) lastAi.content = `Error: ${msg}`
      console.error('[ai-operations]', err)
      return true
    }
  }

  return { handleCommand }
}
