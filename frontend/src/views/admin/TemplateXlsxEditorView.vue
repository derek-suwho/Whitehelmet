<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { useSpreadsheetStore } from '@/stores/spreadsheet'
import { useSpreadsheetEditor, detectHeaderRow } from '@/composables/useSpreadsheetEditor'
import { useTemplatesStore } from '@/stores/templates'
import SpreadsheetEditor from '@/components/editor/SpreadsheetEditor.vue'
import AIChatPanel from '@/components/template/AIChatPanel.vue'

const route = useRoute()
const router = useRouter()
const spreadsheetStore = useSpreadsheetStore()
const { downloadXlsx: downloadAllSheets } = useSpreadsheetEditor()
const templatesStore = useTemplatesStore()

const templateId = (route.params.templateId ?? route.params.id) as string
const projectId = route.query.projectId as string | undefined

const aiChatRef = ref<InstanceType<typeof AIChatPanel> | null>(null)
const headerRow = ref<number | null>(null)
const headerRowConfirmed = ref(false)

const templateName = ref('')
const loadError = ref('')
const saveLoading = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)
const linkCopied = ref(false)

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

function loadWorkbookFromHeaders(headers: string[]) {
  const ws = XLSX.utils.aoa_to_sheet([headers])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Template')
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
      const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellStyles: true, cellNF: true, cellFormula: true })
      spreadsheetStore.loadWorkbook(wb, `${templateName.value}.xlsx`, buffer)
    } else {
      // Fall back to schema_json columns as header row.
      const raw = templatesStore.currentVersion?.schema_json
      const schema = raw
        ? (typeof raw === 'string' ? JSON.parse(raw as string) : raw) as { columns?: { name?: string }[] }
        : null
      const headers: string[] = schema?.columns?.length
        ? schema.columns.map(c => c.name ?? '')
        : ['Column 1', 'Column 2', 'Column 3']
      loadWorkbookFromHeaders(headers)
    }

    // Header row detection
    const existingHeaderRow = templatesStore.currentVersion?.header_row
    if (existingHeaderRow) {
      headerRow.value = existingHeaderRow
      headerRowConfirmed.value = true
    } else {
      nextTick(() => {
        const data = spreadsheetStore.instance?.getData() as unknown[][] | undefined
        if (data?.length) {
          const detected = detectHeaderRow(data) + 1  // 0-indexed → 1-indexed
          const allHeaders = (data[detected - 1] ?? []) as unknown[]
          const headerNames = allHeaders
            .map(v => (v != null ? String(v).trim() : ''))
            .filter(h => h.length > 0)
          const preview = headerNames.slice(0, 6).join(', ')
            + (headerNames.length > 6 ? ` ... (${headerNames.length} total)` : '')
          headerRow.value = detected
          aiChatRef.value?.injectHeaderPrompt(detected, preview)
        }
      })
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load template'
  }
})

function onHeaderRowConfirmed(row: number) {
  headerRow.value = row
  headerRowConfirmed.value = true
}

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
    const hr = (headerRow.value ?? 1) - 1  // 1-indexed → 0-indexed
    const headerRowData = (data[hr] ?? []) as unknown[]
    const headers = headerRowData
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

    await templatesStore.saveVersion(templateId, schemaJson, headerRow.value)
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Save failed'
  } finally {
    saveLoading.value = false
  }
}

async function publish() {
  saveLoading.value = true
  saveError.value = ''
  saveSuccess.value = false
  try {
    await saveTemplate()
    await templatesStore.publishTemplate(templateId)
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Publish failed'
  } finally {
    saveLoading.value = false
  }
}

function downloadXlsx() {
  downloadAllSheets(`${templateName.value || 'template'}.xlsx`)
}

async function copySubmissionLink() {
  const url = `${window.location.origin}/submissions`
  await navigator.clipboard.writeText(url)
  linkCopied.value = true
  setTimeout(() => { linkCopied.value = false }, 2000)
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
        >Download</button>
        <button
          class="rounded-lg border border-gray-300 px-3.5 py-1.5 text-sm transition-colors"
          :class="linkCopied ? 'border-green-300 bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50'"
          @click="copySubmissionLink"
        >{{ linkCopied ? 'Link copied!' : 'Copy DevCo Link' }}</button>
        <button
          :disabled="saveLoading"
          class="rounded-lg border border-gray-300 px-3.5 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          @click="saveTemplate"
        >{{ saveLoading ? 'Saving…' : 'Save Draft' }}</button>
        <button
          :disabled="saveLoading"
          class="bg-violet-600 text-white px-5 py-1.5 rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
          @click="publish"
        >{{ saveLoading ? 'Publishing…' : 'Publish' }}</button>
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
          ref="aiChatRef"
          mode="template-builder"
          :template-id="templateId"
          @schema-generated="onSchemaGenerated"
          @header-confirmed="onHeaderRowConfirmed"
        />
      </div>
    </div>
  </div>
</template>
