<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import * as XLSX from 'xlsx'
import { api } from '@/composables/useApi'
import { useTemplatesStore } from '@/stores/templates'
import { useSpreadsheetStore } from '@/stores/spreadsheet'
import AIChatPanel from '@/components/template/AIChatPanel.vue'
import ConsolidationStatusModal from './modals/ConsolidationStatusModal.vue'
import SpreadsheetEditor from '@/components/editor/SpreadsheetEditor.vue'
import SubmissionTracker from '@/components/admin/SubmissionTracker.vue'

const route = useRoute()
const templatesStore = useTemplatesStore()
const spreadsheetStore = useSpreadsheetStore()

interface OrgStatus {
  org_id: string
  org_name: string
  assignment_id: string
  assignment_status: string
  submission_id: string | null
  submitted_at: string | null
  file_name: string | null
}

interface ProgressData {
  template_id: string
  template_version_id: string | null
  total_orgs: number
  submitted_count: number
  all_submitted: boolean
  orgs: OrgStatus[]
}

const templateId = route.params.templateId as string
const allSubmitted = ref(false)
const progressData = ref<ProgressData | null>(null)
const consolidating = ref(false)
const consolidationResult = ref<{
  consolidated_sheet_id: string
  file_path: string
  freeform_count: number
  template_count: number
} | null>(null)
const consolidationError = ref('')
const showStatusModal = ref(false)
const consolidatedSheetId = ref('')
const loadingPreview = ref(false)

onMounted(() => {
  templatesStore.fetchTemplate(templateId)
  fetchProgress()
})

async function fetchProgress() {
  try {
    progressData.value = await api.get<ProgressData>(
      `/api/admin/templates/${templateId}/consolidation-progress`,
    )
    if (progressData.value?.all_submitted) allSubmitted.value = true
  } catch { /* non-fatal — PM can still consolidate manually */ }
}

function onAllSubmitted() { allSubmitted.value = true }

async function loadPreview(sheetId: string) {
  loadingPreview.value = true
  try {
    const url = await templatesStore.getDownloadUrl(sheetId)
    const resp = await fetch(url, { credentials: 'include' })
    if (!resp.ok) throw new Error('Failed to load sheet')
    const buffer = await resp.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
    spreadsheetStore.loadWorkbook(wb, 'master.xlsx')
  } finally {
    loadingPreview.value = false
  }
}

async function consolidate() {
  if (!templatesStore.currentVersion) return
  consolidating.value = true
  consolidationError.value = ''
  consolidationResult.value = null
  showStatusModal.value = true
  try {
    const data = await api.post<{
      consolidated_sheet_id: string
      file_path: string
      freeform_count: number
      template_count: number
    }>('/api/ai/consolidate', {
      template_id: templateId,
      template_version_id: templatesStore.currentVersion.id,
    })
    consolidationResult.value = data
    consolidatedSheetId.value = data?.consolidated_sheet_id ?? ''
    if (data?.consolidated_sheet_id) {
      await loadPreview(data.consolidated_sheet_id)
    }
  } catch (e) {
    consolidationError.value = e instanceof Error ? e.message : 'Consolidation failed'
  } finally {
    consolidating.value = false
  }
}

async function download() {
  if (!consolidationResult.value) return
  const url = await templatesStore.getDownloadUrl(consolidationResult.value.consolidated_sheet_id)
  window.open(url, '_blank')
}

async function onFinetuneApplied() {
  await templatesStore.fetchConsolidatedSheets(templateId)
  const latest = templatesStore.consolidatedSheets[0]
  if (latest) {
    await loadPreview(latest.id)
  }
}
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <RouterLink to="/admin/templates" class="text-gray-400 hover:text-gray-600 text-sm">← Templates</RouterLink>
        <h1 class="text-xl font-semibold text-gray-800 mt-1">
          Consolidation — {{ templatesStore.currentTemplate?.name ?? '…' }}
        </h1>
      </div>
      <button
        :disabled="!allSubmitted || consolidating"
        class="bg-green-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
        :title="!allSubmitted ? 'Waiting for all DevCos to submit' : ''"
        @click="consolidate"
      >
        {{ consolidating ? 'Consolidating…' : 'Consolidate All' }}
      </button>
    </div>

    <!-- Submission tracking -->
    <SubmissionTracker
      v-if="progressData"
      :progress="progressData"
      @all-submitted="onAllSubmitted"
    />
    <div v-else class="h-20 animate-pulse rounded-xl border border-gray-200 bg-white" />

    <!-- Post-consolidation: preview + AI fine-tune -->
    <div v-if="consolidationResult" class="flex gap-4 h-[500px]">
      <div class="flex-1 border border-gray-200 rounded-xl overflow-hidden relative">
        <div v-if="loadingPreview" class="absolute inset-0 flex items-center justify-center bg-white/80 z-10 text-sm text-gray-500">
          Loading preview…
        </div>
        <SpreadsheetEditor />
      </div>
      <div class="w-80 shrink-0 border border-gray-200 rounded-xl overflow-hidden">
        <AIChatPanel
          mode="consolidation-finetune"
          :template-id="templateId"
          :consolidated-sheet-id="consolidatedSheetId"
          @finetune-applied="onFinetuneApplied"
        />
      </div>
    </div>

    <div v-if="consolidationResult" class="flex justify-end">
      <button
        class="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        @click="download"
      >Download Master Sheet</button>
    </div>
  </div>

  <ConsolidationStatusModal
    :open="showStatusModal"
    :loading="consolidating"
    :result="consolidationResult"
    :error="consolidationError"
    @close="showStatusModal = false"
    @download="download"
  />
</template>
