<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useSpreadsheetStore } from '@/stores/spreadsheet'
import * as XLSX from 'xlsx'

const spreadsheet = useSpreadsheetStore()
const containerRef = ref<HTMLElement | null>(null)

// Watch for workbook changes to mount Jspreadsheet
watch(
  () => spreadsheet.workbook,
  (wb) => {
    if (!wb || !containerRef.value) return
    mountSpreadsheet(wb)
  },
)

onMounted(() => {
  if (spreadsheet.workbook && containerRef.value) {
    mountSpreadsheet(spreadsheet.workbook)
  }
})

function mountSpreadsheet(wb: any) {
  if (!containerRef.value) return

  // If instance was already set by consolidation, skip re-mounting
  if (spreadsheet.instance) return

  const sheetName = wb.SheetNames[0]
  if (!sheetName) return

  const sheet = wb.Sheets[sheetName]
  const json = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
  if (json.length === 0) return

  const headers = (json[0] as unknown[]).map(String)
  const rows = json.slice(1).map((row) =>
    headers.map((_, i) => {
      const val = (row as unknown[])[i]
      return val !== undefined && val !== null ? String(val) : ''
    }),
  )

  // Clear container
  containerRef.value.innerHTML = ''

  // Assign the container an id for useConsolidation compatibility
  containerRef.value.id = 'spreadsheet-container'

  // @ts-expect-error jspreadsheet-ce global
  const jss = window.jspreadsheet
    ? // @ts-expect-error jspreadsheet-ce global
      window.jspreadsheet(containerRef.value, {
        data: rows.length > 0 ? rows : [headers.map(() => '')],
        columns: headers.map((h: string) => ({ title: h, width: 150 })),
        minDimensions: [headers.length, 1],
      })
    : null

  if (jss) {
    spreadsheet.setInstance(jss, wb, spreadsheet.fileName ?? 'Sheet')
  }
}

function handleDownload() {
  const instance = spreadsheet.instance
  const wb = spreadsheet.workbook
  if (!instance && !wb) return

  let outWb: any

  if (instance?.getData && instance?.getHeaders) {
    const headers: string[] = instance.getHeaders()
    const data: unknown[][] = instance.getData()
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
    outWb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(outWb, ws, 'Sheet1')
  } else if (wb) {
    outWb = wb
  }

  if (!outWb) return

  const wbOut = XLSX.write(outWb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbOut], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = spreadsheet.fileName ?? 'spreadsheet.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

function handleClose() {
  if (containerRef.value) {
    containerRef.value.innerHTML = ''
  }
  spreadsheet.clear()
}

onBeforeUnmount(() => {
  // Don't destroy instance on unmount — store manages lifecycle
})
</script>

<template>
  <main
    class="flex flex-1 flex-col overflow-hidden bg-surface-light"
    aria-label="Spreadsheet editor"
  >
    <!-- Toolbar -->
    <div
      v-if="spreadsheet.fileName"
      class="flex items-center justify-between border-b border-white/5 px-4 py-2"
    >
      <div class="flex items-center gap-3">
        <svg
          class="h-4 w-4 text-green-500/70"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5z"
            clip-rule="evenodd"
          />
        </svg>
        <span class="text-sm font-medium text-gray-200">{{ spreadsheet.fileName }}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-sm text-gray-400 transition-colors duration-200 hover:bg-white/5 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-light active:bg-white/10"
          aria-label="Download spreadsheet"
          @click="handleDownload"
        >
          <svg class="mr-1 inline-block h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
          </svg>
          Download
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-sm text-gray-400 transition-colors duration-200 hover:bg-white/5 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-light active:bg-white/10"
          aria-label="Close spreadsheet"
          @click="handleClose"
        >
          Close
        </button>
      </div>
    </div>

    <!-- Spreadsheet container -->
    <div
      v-if="spreadsheet.fileName"
      ref="containerRef"
      id="spreadsheet-container"
      class="flex-1 overflow-auto"
    />

    <!-- Empty state -->
    <div
      v-else
      class="flex flex-1 flex-col items-center justify-center"
    >
      <div class="text-center">
        <svg
          class="mx-auto mb-4 h-16 w-16 text-gray-700/50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1"
            d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M10.875 12h-1.5m1.5 0c.621 0 1.125.504 1.125 1.125M12 12h7.5m-7.5 0c0 .621-.504 1.125-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125m1.125-2.625c-.621 0-1.125.504-1.125 1.125"
          />
        </svg>
        <h3 class="font-display text-lg text-gray-400">No spreadsheet open</h3>
        <p class="mt-2 text-sm leading-relaxed text-gray-600">
          Upload and consolidate files from the<br />Sources panel to get started.
        </p>
      </div>
    </div>
  </main>
</template>
