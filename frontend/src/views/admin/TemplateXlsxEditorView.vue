<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { useSpreadsheetStore } from '@/stores/spreadsheet'
import { useTemplatesStore } from '@/stores/templates'
import SpreadsheetEditor from '@/components/editor/SpreadsheetEditor.vue'
import AIChatPanel from '@/components/template/AIChatPanel.vue'

const route = useRoute()
const router = useRouter()
const spreadsheetStore = useSpreadsheetStore()
const templatesStore = useTemplatesStore()

const templateId = route.params.templateId as string
const projectId = route.query.projectId as string | undefined

const templateName = ref('')
const loadError = ref('')
const saveLoading = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

function loadWorkbookFromHeaders(headers: string[]) {
  const ws = XLSX.utils.aoa_to_sheet([headers])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  spreadsheetStore.loadWorkbook(wb, `${templateName.value || 'template'}.xlsx`)
}

onMounted(async () => {
  try {
    await templatesStore.fetchTemplate(templateId)
    templateName.value = templatesStore.currentTemplate?.name ?? ''

    // Try loading the actual xlsx file first (uploaded templates have file_path)
    const authHeaders = await getAuthHeader()
    const fileResp = await fetch(`/api/templates/${templateId}/download-xlsx`, { headers: authHeaders })

    if (fileResp.ok) {
      const buffer = await fileResp.arrayBuffer()
      const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellStyles: true })

      // Strip to Sheet1 only — other tabs (Quality, Dropdown, etc.) cause #REF! noise
      const keep = wb.SheetNames.includes('Sheet1') ? 'Sheet1' : wb.SheetNames[0]
      for (const name of [...wb.SheetNames]) {
        if (name !== keep) {
          delete wb.Sheets[name]
          wb.SheetNames.splice(wb.SheetNames.indexOf(name), 1)
        }
      }

      // Clear leftover template rows below row 6 (row 6 = first data/output row, rows 7+ are leftovers)
      const ws = wb.Sheets[keep]
      if (ws && ws['!ref']) {
        const range = XLSX.utils.decode_range(ws['!ref'])
        for (let r = 6; r <= range.e.r; r++) {           // row index 6 = row 7 (0-based)
          for (let c = range.s.c; c <= range.e.c; c++) {
            const addr = XLSX.utils.encode_cell({ r, c })
            delete ws[addr]
          }
        }
        range.e.r = 5  // row 6 (0-based)
        ws['!ref'] = XLSX.utils.encode_range(range)
      }

      spreadsheetStore.loadWorkbook(wb, `${templateName.value}.xlsx`, buffer)
    } else {
      // Fall back to schema_json columns as header row.
      // schema_json is stored as a JSON string in the DB — parse it if needed.
      const raw = templatesStore.currentVersion?.schema_json
      const schema = raw
        ? (typeof raw === 'string' ? JSON.parse(raw as string) : raw) as { columns?: { name?: string }[] }
        : null
      const headers: string[] = schema?.columns?.length
        ? schema.columns.map(c => c.name ?? '')
        : ['Column 1', 'Column 2', 'Column 3']
      loadWorkbookFromHeaders(headers)
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load template'
  }
})

// When the AI generates a schema, reload the spreadsheet with those headers
function onSchemaGenerated(schemaJson: object) {
  const cols = ((schemaJson as Record<string, unknown>).columns as { name?: string }[]) ?? []
  const headers = cols.map(c => c.name ?? '').filter(h => h.length > 0)
  if (headers.length > 0) {
    loadWorkbookFromHeaders(headers)
  }
}

async function saveTemplate() {
  const hot = spreadsheetStore.instance
  if (!hot) { saveError.value = 'Spreadsheet not loaded.'; return }

  saveLoading.value = true
  saveError.value = ''
  saveSuccess.value = false

  try {
    const data = hot.getData() as unknown[][]
    const firstRow = (data[0] ?? []) as unknown[]
    const headers = firstRow
      .map(v => (v != null ? String(v).trim() : ''))
      .filter(h => h.length > 0)

    const schemaJson = {
      columns: headers.map(name => ({
        id: crypto.randomUUID(),
        name,
        type: 'text' as const,
      })),
    }

    const trimmedName = templateName.value.trim()
    if (trimmedName && trimmedName !== templatesStore.currentTemplate?.name) {
      await templatesStore.updateTemplate(templateId, trimmedName)
    }

    await templatesStore.saveVersion(templateId, schemaJson)
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Save failed'
  } finally {
    saveLoading.value = false
  }
}

function downloadXlsx() {
  const hot = spreadsheetStore.instance
  if (!hot) return

  const data = hot.getData() as unknown[][]
  const ws = XLSX.utils.aoa_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${templateName.value || 'template'}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

function goBack() {
  if (projectId) {
    router.push({ name: 'admin-project-detail', params: { projectId }, query: { tab: 'document' } })
  } else {
    router.push({ name: 'admin-templates' })
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Top bar -->
    <div class="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
      <div class="flex items-center gap-2 text-sm min-w-0 flex-1 mr-4">
        <button class="text-gray-400 hover:text-gray-600 transition-colors shrink-0" @click="goBack">
          ← Back
        </button>
        <span class="text-gray-300 shrink-0">/</span>
        <input
          v-model="templateName"
          class="text-gray-900 font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-violet-500 focus:outline-none px-1 min-w-0 flex-1"
          placeholder="Template name"
        />
      </div>

      <div class="flex items-center gap-3">
        <span v-if="saveError" class="text-xs text-red-600">{{ saveError }}</span>
        <span v-if="saveSuccess" class="text-xs text-green-600 font-medium">Saved ✓</span>
        <button
          class="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3.5 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          @click="downloadXlsx"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Export .xlsx
        </button>
        <button
          :disabled="saveLoading"
          class="bg-violet-600 text-white px-5 py-1.5 rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
          @click="saveTemplate"
        >
          {{ saveLoading ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </div>

    <!-- Info banner -->
    <div class="px-6 py-2.5 bg-violet-50 border-b border-violet-100 text-xs text-violet-700 shrink-0">
      Build your template by editing column headers in row 1. Use the AI assistant to generate a structure from a description.
    </div>

    <div v-if="loadError" class="p-6 text-red-600 text-sm">{{ loadError }}</div>

    <div v-else class="flex flex-1 min-h-0">
      <div class="flex-1 min-w-0 flex flex-col overflow-hidden">
        <SpreadsheetEditor class="flex-1" />
      </div>
      <div class="w-80 shrink-0 border-l border-gray-200 flex flex-col min-h-0">
        <AIChatPanel
          mode="template-builder"
          :template-id="templateId"
          @schema-generated="onSchemaGenerated"
        />
      </div>
    </div>
  </div>
</template>
