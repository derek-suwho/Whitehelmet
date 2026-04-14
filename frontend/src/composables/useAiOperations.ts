import { api } from '@/composables/useApi'
import { useSpreadsheetStore } from '@/stores/spreadsheet'
import { useChatStore } from '@/stores/chat'
import type { AiCommandResponse, AiOperation, ApiResponse } from '@/types'

export function useAiOperations() {
  async function handleCommand(text: string): Promise<boolean> {
    const spreadsheet = useSpreadsheetStore()
    const chat = useChatStore()
    const jss = spreadsheet.instance

    if (!jss) return false

    // Extract current column headers from Jspreadsheet
    const headers = getColumnHeaders(jss)
    if (headers.length === 0) return false

    try {
      const resp = await api.post<ApiResponse<AiCommandResponse>>('/api/ai/command', {
        message: text,
        headers,
      })

      const { handled, operation, message } = resp.data

      if (!handled || !operation) return false

      applyOperation(jss, operation)

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

// ── Helpers ──

function getColumnHeaders(jss: any): string[] {
  const headers: string[] = []
  const meta = jss.getConfig?.()?.columns ?? jss.options?.columns ?? []

  if (meta.length > 0) {
    for (const col of meta) {
      headers.push(col.title ?? col.name ?? '')
    }
  } else {
    // Fallback: read first row
    const data = jss.getData?.() ?? []
    if (data.length > 0) {
      for (const cell of data[0]) {
        headers.push(String(cell ?? ''))
      }
    }
  }

  return headers
}

function applyOperation(jss: any, op: AiOperation): void {
  const p = op.params as Record<string, any>

  switch (op.type) {
    case 'add_column': {
      const position = p.position ?? getColumnCount(jss)
      const title = p.title ?? 'New Column'
      const defaultValue = p.default_value ?? ''
      jss.insertColumn(1, position, true)
      jss.setHeader(position, title)
      // Fill default values
      if (defaultValue) {
        const rowCount = getRowCount(jss)
        for (let r = 0; r < rowCount; r++) {
          jss.setValueFromCoords(position, r, defaultValue)
        }
      }
      break
    }

    case 'remove_column': {
      const colIdx = resolveColumnIndex(jss, p.column)
      if (colIdx !== -1) {
        jss.deleteColumn(colIdx, 1)
      }
      break
    }

    case 'rename_column': {
      const colIdx = resolveColumnIndex(jss, p.column)
      const newName = p.new_name ?? ''
      if (colIdx !== -1 && newName) {
        jss.setHeader(colIdx, newName)
      }
      break
    }

    case 'sort': {
      const colIdx = resolveColumnIndex(jss, p.column)
      const ascending = p.ascending !== false
      if (colIdx !== -1) {
        jss.orderBy(colIdx, ascending ? 0 : 1)
      }
      break
    }

    case 'apply_formula': {
      const colIdx = resolveColumnIndex(jss, p.column)
      const formula = p.formula as string
      if (colIdx !== -1 && formula) {
        const rowCount = getRowCount(jss)
        for (let r = 0; r < rowCount; r++) {
          // Replace row placeholder {ROW} with 1-indexed row number
          const resolved = formula.replace(/\{ROW\}/g, String(r + 1))
          jss.setValueFromCoords(colIdx, r, resolved)
        }
      }
      break
    }
  }
}

function resolveColumnIndex(jss: any, column: string | number): number {
  if (typeof column === 'number') return column

  // Try matching by header title
  const headers = getColumnHeaders(jss)
  const lower = column.toLowerCase()
  const idx = headers.findIndex((h) => h.toLowerCase() === lower)
  return idx
}

function getColumnCount(jss: any): number {
  const data = jss.getData?.() ?? []
  return data.length > 0 ? data[0].length : 0
}

function getRowCount(jss: any): number {
  const data = jss.getData?.() ?? []
  return data.length
}
