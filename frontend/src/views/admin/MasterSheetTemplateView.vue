<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as XLSX from 'xlsx'
import { HyperFormula } from 'hyperformula'
import Handsontable from 'handsontable'
import { useSpreadsheetStore } from '@/stores/spreadsheet'
import { useTemplatesStore } from '@/stores/templates'
import { supabase } from '@/lib/supabase'
import SpreadsheetEditor from '@/components/editor/SpreadsheetEditor.vue'

const route = useRoute()
const router = useRouter()
const spreadsheetStore = useSpreadsheetStore()
const templatesStore = useTemplatesStore()

const sheetId = route.params.sheetId as string
const templateId = route.query.template_id as string | undefined
const projectId = route.query.project_id as string | undefined

const loadError = ref('')
const loading = ref(true)

// Split-screen state
const showSplit = ref(false)
const masterContainerRef = ref<HTMLDivElement | null>(null)
const masterLoading = ref(false)
const masterError = ref('')
let masterHot: Handsontable | null = null

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

onMounted(async () => {
  try {
    const headers = await getAuthHeader()
    const resp = await fetch(`/api/admin/consolidated-sheets/${sheetId}/stamped-template`, { headers })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      let detail = `HTTP ${resp.status}`
      try { detail = JSON.parse(text).detail || detail } catch { detail = text || detail }
      throw new Error(detail)
    }
    const buffer = await resp.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellStyles: true, cellNF: true, cellFormula: true })
    spreadsheetStore.loadWorkbook(wb, 'template-view.xlsx', buffer)
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load template view'
  } finally {
    loading.value = false
  }

  if (templateId) templatesStore.fetchTemplate(templateId)
})

onBeforeUnmount(() => {
  masterHot?.destroy()
  masterHot = null
})

async function toggleSplit() {
  showSplit.value = !showSplit.value
  if (showSplit.value) {
    masterHot?.destroy()
    masterHot = null
    await loadMasterSheet()
  } else {
    masterHot?.destroy()
    masterHot = null
  }
}

async function loadMasterSheet() {
  masterLoading.value = true
  masterError.value = ''
  try {
    const headers = await getAuthHeader()
    const resp = await fetch(`/api/templates/consolidations/${sheetId}/download`, { headers })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const buffer = await resp.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellFormula: true, cellNF: true, cellStyles: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    if (!ws || !ws['!ref']) { masterLoading.value = false; return }

    const range = XLSX.utils.decode_range(ws['!ref'])
    const maxCols = range.e.c + 1
    const maxRows = range.e.r + 1

    // Same cell-reading strategy as useSpreadsheetEditor: inject formula strings
    // for HyperFormula, raw values otherwise.
    const data: any[][] = []
    for (let R = 0; R < maxRows; R++) {
      const row: any[] = []
      for (let C = 0; C < maxCols; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C })
        const cell = ws[addr]
        if (!cell) { row.push(''); continue }
        if (cell.t === 'e') {
          row.push(cell.w || cell.v || '')
        } else if (cell.f) {
          row.push('=' + cell.f)
        } else {
          row.push(cell.v !== undefined && cell.v !== null ? cell.v : '')
        }
      }
      data.push(row)
    }

    // Set loading false so the container div renders, then mount Handsontable
    masterLoading.value = false
    await nextTick()
    if (!masterContainerRef.value) return

    masterHot = new Handsontable(masterContainerRef.value, {
      data,
      readOnly: true,
      licenseKey: 'non-commercial-and-evaluation',
      theme: 'ht-theme-main',
      formulas: { engine: HyperFormula, licenseKey: 'non-commercial-and-evaluation' } as any,
      width: '100%',
      height: '100%',
      rowHeaders: true,
      colHeaders: true,
      stretchH: 'none',
      autoColumnSize: true,
      manualColumnResize: true,
      contextMenu: false,
      fillHandle: false,
      outsideClickDeselects: true,
    })
  } catch (e) {
    masterError.value = e instanceof Error ? e.message : 'Failed to load master sheet'
    masterLoading.value = false
  }
}

function goBack() {
  const query: Record<string, string> = {}
  if (templateId) query.template_id = templateId
  if (projectId) query.project_id = projectId
  router.push({ name: 'admin-master-sheet', params: { sheetId }, query })
}

function download() {
  getAuthHeader().then(headers => {
    fetch(`/api/admin/consolidated-sheets/${sheetId}/stamped-template`, { headers })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'template-view.xlsx'
        a.click()
        URL.revokeObjectURL(url)
      })
  })
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Top bar -->
    <div class="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
      <div class="flex items-center gap-2 text-sm">
        <button class="text-gray-400 hover:text-gray-600 transition-colors" @click="goBack">
          ← Master Sheet
        </button>
        <span class="text-gray-300">/</span>
        <span class="text-gray-800 font-semibold">
          Template View{{ templatesStore.currentTemplate ? ` — ${templatesStore.currentTemplate.name}` : '' }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-1.5 border px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
          :class="showSplit
            ? 'border-violet-400 bg-violet-50 text-violet-700 hover:bg-violet-100'
            : 'border-gray-300 text-gray-600 hover:bg-gray-50'"
          @click="toggleSplit"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M12 3v18"/>
          </svg>
          {{ showSplit ? 'Hide Master Sheet' : 'Compare with Master Sheet' }}
        </button>
        <button
          class="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          @click="download"
        >
          Download xlsx
        </button>
      </div>
    </div>

    <!-- Error state -->
    <div v-if="loadError" class="p-6 text-red-600 text-sm">{{ loadError }}</div>

    <!-- Loading state -->
    <div v-else-if="loading" class="flex-1 flex items-center justify-center text-gray-400 text-sm">
      Loading template view…
    </div>

    <!-- Split or single layout -->
    <div v-else class="flex flex-1 min-h-0 overflow-hidden">

      <!-- Left panel: Master Sheet Handsontable -->
      <div
        v-if="showSplit"
        class="w-1/2 shrink-0 flex flex-col min-h-0 border-r border-gray-200"
      >
        <div class="px-4 py-2 bg-gray-50 border-b border-gray-200 shrink-0 flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
          <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Master Sheet (Consolidated Output)</span>
        </div>
        <div v-if="masterLoading" class="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Loading master sheet…
        </div>
        <div v-else-if="masterError" class="p-4 text-red-600 text-sm">{{ masterError }}</div>
        <div v-else ref="masterContainerRef" class="flex-1 min-h-0 overflow-hidden" />
      </div>

      <!-- Right panel: Template View -->
      <div class="flex flex-col min-h-0 overflow-hidden" :class="showSplit ? 'w-1/2' : 'flex-1'">
        <div v-if="showSplit" class="px-4 py-2 bg-gray-50 border-b border-gray-200 shrink-0 flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-violet-500 shrink-0"></div>
          <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Template View (Stamped Formula Layout)</span>
        </div>
        <SpreadsheetEditor class="flex-1 min-h-0" />
      </div>

    </div>
  </div>
</template>
