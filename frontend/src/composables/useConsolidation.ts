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
      const payload: ConsolidationPayload = { files: [] }

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

        payload.files.push({ name: file.name, headers, rows })
      }

      if (payload.files.length === 0) {
        chat.addMessage('No valid spreadsheet data found in selected files.', 'system')
        return
      }

      // Send to backend AI consolidation endpoint
      const resp = await api.post<ApiResponse<ConsolidationResponse>>(
        '/api/ai/consolidate',
        payload,
      )

      const { headers, rows } = resp.data

      // Build a synthetic xlsx file from the consolidated result
      const wsData = [headers, ...rows]
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Consolidated')

      const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([wbOut], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const syntheticFile = new File([blob], 'consolidated.xlsx', { type: blob.type })

      // Open in spreadsheet editor
      // Read back as workbook for the store
      const readBuffer = await syntheticFile.arrayBuffer()
      const readWb = XLSX.read(readBuffer, { type: 'array' })

      // Create Jspreadsheet data
      const readSheet = readWb.Sheets[readWb.SheetNames[0]]
      const readJson = XLSX.utils.sheet_to_json<unknown[]>(readSheet, { header: 1 })
      const colHeaders = (readJson[0] as unknown[]).map(String)
      const dataRows = readJson.slice(1).map((row) =>
        colHeaders.map((_, i) => {
          const val = (row as unknown[])[i]
          return val !== undefined && val !== null ? String(val) : ''
        }),
      )

      // Destroy existing instance if any
      spreadsheet.clear()

      // Create Jspreadsheet instance
      const el = document.getElementById('spreadsheet-container')
      if (!el) throw new Error('Spreadsheet container not found')

      // @ts-expect-error jspreadsheet is loaded globally
      const jss = jspreadsheet(el, {
        data: dataRows.length > 0 ? dataRows : [colHeaders.map(() => '')],
        columns: colHeaders.map((h) => ({ title: h, width: 150 })),
        minDimensions: [colHeaders.length, 1],
      })

      spreadsheet.setInstance(jss, readWb, 'consolidated.xlsx')
      chat.addMessage(
        `Consolidated ${payload.files.length} files: ${colHeaders.length} columns, ${dataRows.length} rows.`,
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
