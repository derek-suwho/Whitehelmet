import { ref } from 'vue'
import * as XLSX from 'xlsx'
import { api } from '@/composables/useApi'
import { useSourcesStore } from '@/stores/sources'
import { useSpreadsheetStore } from '@/stores/spreadsheet'
import { useChatStore } from '@/stores/chat'

const SAMPLE_ROWS = 3
const KEY_VALUE_FIELD_NAMES = new Set(['field', 'key', 'label', 'parameter', 'metric', 'name', 'attribute'])

interface ParsedFile {
  name: string
  headers: string[]
  allRows: unknown[][]
}

interface ColumnMapping {
  file: string
  column_map: Record<string, string>
}

interface SchemaResponse {
  unified_headers: string[]
  mappings: ColumnMapping[]
}

const isConsolidating = ref(false)

/** Find the two column indices where KV data actually lives (may be offset, e.g. cols 2+3). */
function findKVColumns(rows: unknown[][]): [number, number] | null {
  const nonEmpty = rows.filter((r) => (r as unknown[]).some((c) => c != null && c !== ''))
  if (nonEmpty.length === 0) return null
  const maxCols = Math.max(...nonEmpty.map((r) => (r as unknown[]).length))
  const counts = new Array(maxCols).fill(0)
  for (const row of nonEmpty) {
    ;(row as unknown[]).forEach((c, i) => { if (c != null && c !== '') counts[i]++ })
  }
  const threshold = nonEmpty.length * 0.4
  const active = counts.map((n, i) => ({ i, n })).filter((x) => x.n >= threshold)
  return active.length === 2 ? [active[0].i, active[1].i] : null
}

/** Detect whether a single file looks like a key-value form report. */
function isKVFile(f: ParsedFile): boolean {
  const nonEmptyH = f.headers.filter((h) => h.trim() !== '')
  // Standard: 2 named columns, first is a label column
  if (nonEmptyH.length === 2 && KEY_VALUE_FIELD_NAMES.has(nonEmptyH[0].toLowerCase().trim())) return true
  // Sparse/empty headers: inspect data rows
  if (nonEmptyH.length <= 1) {
    const cols = findKVColumns(f.allRows)
    if (cols) {
      const dataRows = f.allRows.filter((r) => (r as unknown[]).some((c) => c != null && c !== ''))
      const firstVals = dataRows.map((r) => (r as unknown[])[cols[0]]).filter(Boolean)
      const stringRatio = firstVals.filter((v) => typeof v === 'string').length / (firstVals.length || 1)
      return stringRatio > 0.7
    }
  }
  return false
}

/** Extract KV pairs from a file, handling column offsets. */
function extractKV(f: ParsedFile): { fieldOrder: string[]; kvMap: Record<string, unknown> } {
  const dataRows = f.allRows.filter((r) => (r as unknown[]).some((c) => c != null && c !== ''))
  const cols = findKVColumns(dataRows) ?? [0, 1]
  const kvMap: Record<string, unknown> = {}
  const fieldOrder: string[] = []
  for (const row of dataRows) {
    const cells = row as unknown[]
    const field = String(cells[cols[0]] ?? '').trim()
    const value = cells[cols[1]] ?? ''
    if (field && !(field in kvMap)) fieldOrder.push(field)
    if (field) kvMap[field] = value
  }
  return { fieldOrder, kvMap }
}

/** Pivot a set of KV files into wide format (one row per file). */
function pivotKVFiles(files: ParsedFile[]): { headers: string[]; rows: unknown[][] } {
  const fieldSet = new Set<string>()
  const fieldOrder: string[] = []
  const extracted = files.map((f) => extractKV(f))
  for (const { fieldOrder: fo } of extracted) {
    for (const fn of fo) {
      if (!fieldSet.has(fn)) { fieldSet.add(fn); fieldOrder.push(fn) }
    }
  }
  return {
    headers: fieldOrder,
    rows: files.map((f, i) => [f.name, ...fieldOrder.map((fn) => extracted[i].kvMap[fn] ?? '')]),
  }
}

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
      // Parse all files client-side
      const parsed: ParsedFile[] = []
      for (const file of files) {
        const buffer = await file.arrayBuffer()
        const wb = XLSX.read(buffer, { type: 'array' })
        const sheetName = wb.SheetNames[0]
        if (!sheetName) continue
        const sheet = wb.Sheets[sheetName]
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
        if (aoa.length === 0) continue
        const headers = Array.from(aoa[0] as unknown[], (v) => (v == null ? '' : String(v)))
        const allRows = aoa.slice(1)
        parsed.push({ name: file.name, headers, allRows })
      }

      if (parsed.length === 0) {
        chat.addMessage('No valid spreadsheet data found in selected files.', 'system')
        return
      }

      const kvFiles = parsed.filter(isKVFile)
      const tabularFiles = parsed.filter((f) => !isKVFile(f))

      // KV files → pivot to wide (one row per file)
      let kvHeaders: string[] = []
      let kvRows: unknown[][] = []
      if (kvFiles.length > 0) {
        const pivoted = pivotKVFiles(kvFiles)
        kvHeaders = pivoted.headers
        kvRows = pivoted.rows
      }

      // Tabular files → AI schema mapping
      let tabHeaders: string[] = []
      let tabRows: unknown[][] = []
      if (tabularFiles.length > 0) {
        const { unified_headers: uh, mappings } = await api.post<SchemaResponse>(
          '/api/ai/consolidate',
          {
            files_schema: tabularFiles.map((f) => ({
              name: f.name,
              headers: f.headers,
              sample_rows: f.allRows.slice(0, SAMPLE_ROWS),
            })),
          },
        )
        // uh[0] is "Source File" added by AI — skip it when building the union
        tabHeaders = uh.slice(1)

        for (const f of tabularFiles) {
          const mapping = mappings.find((m) => m.file === f.name)
          if (!mapping) continue
          const unifiedToIdx: Record<string, number> = {}
          for (const [src, unified] of Object.entries(mapping.column_map)) {
            const idx = f.headers.indexOf(src)
            if (idx >= 0) unifiedToIdx[unified] = idx
          }
          for (const row of f.allRows) {
            tabRows.push([
              f.name,
              ...tabHeaders.map((h) => {
                const srcIdx = unifiedToIdx[h]
                return srcIdx !== undefined ? (row as unknown[])[srcIdx] ?? '' : ''
              }),
            ])
          }
        }
      }

      // Union all extra columns: KV headers first, then tabular headers (deduped)
      const extraHeaders: string[] = [...kvHeaders]
      for (const h of tabHeaders) {
        if (!extraHeaders.includes(h)) extraHeaders.push(h)
      }
      const unified_headers = ['Source File', ...extraHeaders]

      // Map KV rows to unified column order
      const mappedKV = kvRows.map((row) =>
        unified_headers.map((h, i) => {
          if (i === 0) return row[0]
          const ki = kvHeaders.indexOf(h)
          return ki >= 0 ? row[ki + 1] : ''
        }),
      )

      // Map tabular rows to unified column order
      const mappedTab = tabRows.map((row) =>
        unified_headers.map((h, i) => {
          if (i === 0) return row[0]
          const ti = tabHeaders.indexOf(h)
          return ti >= 0 ? row[ti + 1] : ''
        }),
      )

      const mergedRows = [...mappedKV, ...mappedTab]

      const ws = XLSX.utils.aoa_to_sheet([unified_headers, ...mergedRows])
      const consolidatedWb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(consolidatedWb, ws, 'Consolidated')
      spreadsheet.loadWorkbook(consolidatedWb, 'consolidated.xlsx')
      spreadsheet.setPendingSave({ headers: unified_headers, rows: mergedRows })

      chat.addMessage(
        `Consolidated ${parsed.length} files — ${unified_headers.length} columns, ${mergedRows.length} rows.`,
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
