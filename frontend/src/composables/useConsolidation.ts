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

/**
 * Detect key-value format: exactly 2 columns where the first is a label/field column.
 * E.g. ["Field", "Value"] — common in form-style reports.
 */
function isKeyValueFormat(files: ParsedFile[]): boolean {
  return files.every(
    (f) =>
      f.headers.length === 2 &&
      KEY_VALUE_FIELD_NAMES.has(f.headers[0].toLowerCase().trim()),
  )
}

/**
 * Pivot key-value files into wide format.
 * Each file becomes one row; each unique field name becomes a column.
 * Preserves field order from first occurrence across files.
 */
function pivotKeyValue(files: ParsedFile[]): { headers: string[]; rows: unknown[][] } {
  // Collect all unique field names in encounter order
  const fieldOrder: string[] = []
  const fieldSet = new Set<string>()
  for (const f of files) {
    for (const row of f.allRows) {
      const field = String((row as unknown[])[0] ?? '').trim()
      if (field && !fieldSet.has(field)) {
        fieldSet.add(field)
        fieldOrder.push(field)
      }
    }
  }

  const headers = ['Source File', ...fieldOrder]

  const rows = files.map((f) => {
    // Build field→value map for this file
    const kvMap: Record<string, unknown> = {}
    for (const row of f.allRows) {
      const cells = row as unknown[]
      const field = String(cells[0] ?? '').trim()
      if (field) kvMap[field] = cells[1] ?? ''
    }
    return [f.name, ...fieldOrder.map((col) => kvMap[col] ?? '')]
  })

  return { headers, rows }
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
        const headers = (aoa[0] as unknown[]).map(String)
        const allRows = aoa.slice(1)
        parsed.push({ name: file.name, headers, allRows })
      }

      if (parsed.length === 0) {
        chat.addMessage('No valid spreadsheet data found in selected files.', 'system')
        return
      }

      let unified_headers: string[]
      let mergedRows: unknown[][]

      if (isKeyValueFormat(parsed)) {
        // Key-value files (e.g. Field/Value form reports): pivot into wide table — no AI needed
        const pivoted = pivotKeyValue(parsed)
        unified_headers = pivoted.headers
        mergedRows = pivoted.rows
      } else {
        // Tabular files: AI detects column mapping, client applies it
        const { unified_headers: uh, mappings } = await api.post<SchemaResponse>(
          '/api/ai/consolidate',
          {
            files_schema: parsed.map((f) => ({
              name: f.name,
              headers: f.headers,
              sample_rows: f.allRows.slice(0, SAMPLE_ROWS),
            })),
          },
        )
        unified_headers = uh

        mergedRows = []
        for (const f of parsed) {
          const mapping = mappings.find((m) => m.file === f.name)
          if (!mapping) continue

          const unifiedToIdx: Record<string, number> = {}
          for (const [src, unified] of Object.entries(mapping.column_map)) {
            const idx = f.headers.indexOf(src)
            if (idx >= 0) unifiedToIdx[unified] = idx
          }

          for (const row of f.allRows) {
            const cells = unified_headers.map((uh, i) => {
              if (i === 0) return f.name
              const srcIdx = unifiedToIdx[uh]
              return srcIdx !== undefined ? (row as unknown[])[srcIdx] ?? '' : ''
            })
            mergedRows.push(cells)
          }
        }
      }

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
