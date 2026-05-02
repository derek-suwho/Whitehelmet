<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as XLSX from 'xlsx'
import { api } from '@/composables/useApi'
import { useSpreadsheetStore } from '@/stores/spreadsheet'
import { useTemplatesStore } from '@/stores/templates'
import SpreadsheetEditor from '@/components/editor/SpreadsheetEditor.vue'
import AIChatPanel from '@/components/template/AIChatPanel.vue'

const route = useRoute()
const router = useRouter()
const spreadsheetStore = useSpreadsheetStore()
const templatesStore = useTemplatesStore()

const sheetId = route.params.sheetId as string
const templateId = route.query.template_id as string | undefined
const projectId = route.query.project_id as string | undefined
const submissionIdsParam = route.query.submission_ids as string | undefined
const includedSubmissionIds = submissionIdsParam ? new Set(submissionIdsParam.split(',')) : null

interface OrgStatus {
  org_id: string
  org_name: string
  submission_id: string | null
  file_name: string | null
}

const subcontractors = ref<OrgStatus[]>([])
const loadError = ref('')

onMounted(async () => {
  // Load workbook — SpreadsheetEditor is already mounted so getElementById works
  try {
    const resp = await fetch(`/api/templates/consolidations/${sheetId}/download`, { credentials: 'include' })
    if (!resp.ok) throw new Error('Failed to load consolidated sheet')
    const buffer = await resp.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
    spreadsheetStore.loadWorkbook(wb, 'master.xlsx', buffer)
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load sheet'
  }

  // Fetch subcontractor list
  if (templateId) {
    try {
      const url = projectId
        ? `/api/admin/templates/${templateId}/consolidation-progress?project_id=${projectId}`
        : `/api/admin/templates/${templateId}/consolidation-progress`
      const data = await api.get<{ orgs: OrgStatus[] }>(url)
      const submitted = data.orgs.filter(o => o.submission_id !== null)
      // If specific submissions were consolidated, filter to only those; then deduplicate by org
      const filtered = includedSubmissionIds
        ? submitted.filter(o => o.submission_id && includedSubmissionIds.has(o.submission_id))
        : submitted
      const seen = new Set<string>()
      subcontractors.value = filtered.filter(o => {
        if (seen.has(o.org_id)) return false
        seen.add(o.org_id)
        return true
      })
    } catch { /* non-fatal */ }
  }

  if (templateId) templatesStore.fetchTemplate(templateId)
})

async function reloadAfterFinetune() {
  try {
    const resp = await fetch(`/api/templates/consolidations/${sheetId}/download`, { credentials: 'include' })
    if (!resp.ok) return
    const buffer = await resp.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
    spreadsheetStore.loadWorkbook(wb, 'master.xlsx', buffer)
  } catch { /* non-fatal */ }
}

function goBack() {
  if (templateId) {
    const query = projectId ? `?project_id=${projectId}` : ''
    router.push(`/admin/consolidations/${templateId}${query}`)
  } else {
    router.push('/admin/dashboard')
  }
}

function download() {
  window.open(`/api/templates/consolidations/${sheetId}/download`, '_blank')
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Top bar -->
    <div class="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
      <div class="flex items-center gap-2 text-sm">
        <button class="text-gray-400 hover:text-gray-600 transition-colors" @click="goBack">
          ← Subcontractors
        </button>
        <span class="text-gray-300">/</span>
        <span class="text-gray-800 font-semibold">
          Master Sheet{{ templatesStore.currentTemplate ? ` — ${templatesStore.currentTemplate.name}` : '' }}
        </span>
      </div>
      <button
        class="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        @click="download"
      >
        Download xlsx
      </button>
    </div>

    <!-- Error state -->
    <div v-if="loadError" class="p-6 text-red-600 text-sm">{{ loadError }}</div>

    <!-- Content -->
    <div v-else class="flex flex-1 min-h-0">
      <!-- Spreadsheet (main area) -->
      <div class="flex-1 min-w-0 flex flex-col overflow-hidden">
        <SpreadsheetEditor class="flex-1" />
      </div>

      <!-- Right sidebar -->
      <div class="w-72 shrink-0 border-l border-gray-200 flex flex-col min-h-0">
        <!-- Subcontractors section -->
        <div class="border-b border-gray-200 p-4 shrink-0">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Subcontractors
              <span class="text-gray-400 font-normal normal-case">({{ subcontractors.length }})</span>
            </span>
            <button
              class="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
              @click="goBack"
            >
              + Add More
            </button>
          </div>
          <div v-if="subcontractors.length" class="space-y-1.5 max-h-40 overflow-y-auto">
            <div
              v-for="org in subcontractors"
              :key="org.org_id"
              class="flex items-center gap-2 text-sm text-gray-700"
            >
              <div class="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></div>
              {{ org.org_name }}
            </div>
          </div>
          <div v-else class="text-xs text-gray-400 italic">Loading…</div>
        </div>

        <!-- AI Fine-Tuning -->
        <div class="flex-1 min-h-0">
          <AIChatPanel
            mode="consolidation-finetune"
            :template-id="templateId ?? ''"
            :consolidated-sheet-id="sheetId"
            @finetune-applied="reloadAfterFinetune"
          />
        </div>
      </div>
    </div>
  </div>
</template>
