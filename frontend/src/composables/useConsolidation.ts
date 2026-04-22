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
      // Parse each xlsx file client-side
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

      // Send to backend AI consolidation endpoint
      const resp = await api.post<ApiResponse<ConsolidationResponse>>(
        '/api/ai/consolidate',
        payload,
      )

      const { headers, rows } = resp.data

      // Build workbook from consolidated result
      const wsData = [headers, ...rows]
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      const consolidatedWb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(consolidatedWb, ws, 'Consolidated')

      // Load into editor via store — SpreadsheetEditor watches workbook and mounts Handsontable
      spreadsheet.loadWorkbook(consolidatedWb, 'consolidated.xlsx')
      spreadsheet.setPendingSave({ headers, rows: rows as unknown[][] })

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
