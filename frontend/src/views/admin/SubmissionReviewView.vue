<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as XLSX from 'xlsx'
import { api } from '@/composables/useApi'
import { useSpreadsheetEditor } from '@/composables/useSpreadsheetEditor'
import { supabase } from '@/lib/supabase'
import { useSpreadsheetStore } from '@/stores/spreadsheet'
import SpreadsheetEditor from '@/components/editor/SpreadsheetEditor.vue'
import AIChatPanel from '@/components/template/AIChatPanel.vue'

const route = useRoute()
const router = useRouter()
const spreadsheetStore = useSpreadsheetStore()
const { toXlsxBytes } = useSpreadsheetEditor()

const submissionId = route.params.submissionId as string
const fileName = ref((route.query.fileName as string | undefined) ?? 'submission.xlsx')

const loadError = ref('')
const saveLoading = ref(false)
const saveError = ref('')
const saveSuccess = ref('')

// Review panel state
const reviewStatus = ref<'approved' | 'changes_requested' | ''>('')
const reviewComment = ref('')
const reviewLoading = ref(false)
const reviewError = ref('')
const reviewSuccess = ref('')
const currentReview = ref<{ status: string; comment: string | null } | null>(null)

// Dual view state
const viewMode = ref<'raw' | 'processed'>('raw')
const hasProcessed = ref(false)
const hasFormulas = ref(false)
const fileRevision = ref(0)
const canSave = ref(true)
const pendingChanges = ref<Map<string, { row: number; col: number; value: any }>>(new Map())

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

onMounted(async () => {
  // Fetch submission metadata
  try {
    const headers = await getAuthHeader()
    const meta = await fetch(`/api/admin/submissions/${submissionId}`, { headers })
    if (meta.ok) {
      const data = await meta.json()
      hasProcessed.value = data.has_processed ?? false
      fileRevision.value = data.file_revision ?? 0
      if (data.review_status) {
        reviewStatus.value = data.review_status as 'approved' | 'changes_requested'
        reviewComment.value = data.review_comment ?? ''
        currentReview.value = { status: data.review_status, comment: data.review_comment ?? null }
      }
    }
  } catch { /* non-fatal */ }

  // Load the file (processed if available, otherwise raw)
  try {
    const mode = hasProcessed.value ? 'processed' : 'raw'
    const headers = await getAuthHeader()
    const resp = await fetch(
      `/api/admin/submissions/${submissionId}/download?type=${mode}`,
      { headers },
    )
    if (!resp.ok) throw new Error(`Failed to load submission (${resp.status})`)
    const buffer = await resp.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellStyles: true, cellNF: true, cellFormula: true })
    spreadsheetStore.loadWorkbook(wb, fileName.value, buffer)
    viewMode.value = mode

    // Raw = read-only, Calculated = editable
    const hot = spreadsheetStore.instance
    if (hot) {
      hot.updateSettings({ readOnly: mode === 'raw' })
    }
    canSave.value = mode === 'processed'
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load submission file'
  }
})

async function switchView(mode: 'raw' | 'processed') {
  if (mode === viewMode.value) return
  viewMode.value = mode
  try {
    const headers = await getAuthHeader()
    const resp = await fetch(
      `/api/admin/submissions/${submissionId}/download?type=${mode}`,
      { headers },
    )
    if (!resp.ok) throw new Error(`Failed to load ${mode} file`)
    const buffer = await resp.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellStyles: true, cellNF: true, cellFormula: true })
    spreadsheetStore.loadWorkbook(wb, fileName.value, buffer)

    const hot = spreadsheetStore.instance
    if (hot) {
      hot.updateSettings({ readOnly: mode === 'raw' })
    }
    canSave.value = mode === 'processed'
    pendingChanges.value.clear()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : `Failed to load ${mode} file`
    viewMode.value = mode === 'raw' ? 'processed' : 'raw'
  }
}

async function confirmRecalculate() {
  if (!confirm('This will regenerate the calculated sheet from the original raw submission + formulas, discarding any manual edits. Continue?')) return
  try {
    const headers = await getAuthHeader()
    const resp = await fetch(`/api/admin/submissions/${submissionId}/recalculate`, {
      method: 'POST', headers,
    })
    if (!resp.ok) throw new Error('Recalculate failed')
    const data = await resp.json()
    fileRevision.value = data.revision ?? fileRevision.value
    hasProcessed.value = true
    viewMode.value = 'raw' // force re-fetch on switchView
    await switchView('processed')
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Recalculate failed'
  }
}

async function saveChanges() {
  if (viewMode.value === 'processed' && pendingChanges.value.size > 0) {
    // Cell-patch save for processed view
    saveLoading.value = true
    saveError.value = ''
    saveSuccess.value = ''
    try {
      const headers = await getAuthHeader()
      const resp = await fetch(`/api/admin/submissions/${submissionId}/cells`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: Array.from(pendingChanges.value.values()),
          revision: fileRevision.value,
        }),
      })
      if (resp.status === 409) {
        saveError.value = 'File was modified by another user. Please reload.'
        return
      }
      if (!resp.ok) throw new Error('Save failed')
      const data = await resp.json()
      fileRevision.value = data.revision
      pendingChanges.value.clear()
      saveSuccess.value = 'Changes saved successfully.'
    } catch (e) {
      saveError.value = e instanceof Error ? e.message : 'Failed to save changes'
    } finally {
      saveLoading.value = false
    }
    return
  }

  // Full-replace save — preserves all sheets
  const bytes = toXlsxBytes()
  if (!bytes) { saveError.value = 'Spreadsheet not loaded yet.'; return }

  saveLoading.value = true
  saveError.value = ''
  saveSuccess.value = ''

  try {
    const blob = new Blob([bytes as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const formData = new FormData()
    formData.append('file', blob, fileName.value)

    const headers = await getAuthHeader()
    const resp = await fetch(`/api/admin/submissions/${submissionId}/file`, {
      method: 'PUT',
      headers,
      body: formData,
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => resp.statusText)
      throw new Error(text)
    }
    saveSuccess.value = 'Changes saved successfully.'
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Failed to save changes'
  } finally {
    saveLoading.value = false
  }
}

async function submitReview() {
  if (!reviewStatus.value) {
    reviewError.value = 'Select Approve or Request Changes before submitting.'
    return
  }
  reviewLoading.value = true
  reviewError.value = ''
  reviewSuccess.value = ''
  try {
    const result = await api.post<{
      review_status: string | null
      review_comment: string | null
    }>(`/api/admin/submissions/${submissionId}/review`, {
      status: reviewStatus.value,
      comment: reviewComment.value || null,
    })
    currentReview.value = {
      status: result.review_status ?? reviewStatus.value,
      comment: result.review_comment ?? null,
    }
    reviewSuccess.value = reviewStatus.value === 'approved'
      ? 'Submission approved.'
      : 'Changes requested.'
  } catch (e) {
    reviewError.value = e instanceof Error ? e.message : 'Failed to submit review'
  } finally {
    reviewLoading.value = false
  }
}

const kpiLoading = ref(false)
const kpiError = ref('')
const kpiSuccess = ref('')

async function generateKpiReport() {
  kpiLoading.value = true
  kpiError.value = ''
  kpiSuccess.value = ''
  try {
    const result = await api.post<{ sheet_id: string; name: string }>(
      `/api/admin/submissions/${submissionId}/kpi-report`,
      {},
    )
    kpiSuccess.value = 'Report generated!'
    router.push(`/admin/master-sheets/${result.sheet_id}`)
  } catch (e) {
    kpiError.value = e instanceof Error ? e.message : 'Failed to generate report'
  } finally {
    kpiLoading.value = false
  }
}

function goBack() {
  router.back()
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Top bar -->
    <div class="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
      <div class="flex items-center gap-2 text-sm">
        <button class="text-gray-400 hover:text-gray-600 transition-colors" @click="goBack">
          ← Back
        </button>
        <span class="text-gray-300">/</span>
        <span class="text-gray-800 font-semibold">Review Submission</span>
        <span v-if="fileName" class="text-gray-400 font-normal">— {{ fileName }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span v-if="kpiError" class="text-xs text-red-600">{{ kpiError }}</span>
        <span v-if="saveSuccess" class="text-xs text-green-600">{{ saveSuccess }}</span>
        <span v-if="saveError" class="text-xs text-red-600">{{ saveError }}</span>
        <button
          :disabled="kpiLoading"
          class="border border-violet-400 text-violet-700 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-violet-50 disabled:opacity-50 transition-colors"
          @click="generateKpiReport"
        >
          {{ kpiLoading ? 'Generating…' : 'Generate KPI Report' }}
        </button>
        <button
          v-if="canSave"
          :disabled="saveLoading"
          class="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          @click="saveChanges"
        >
          {{ saveLoading ? 'Saving…' : 'Save Changes' }}
        </button>
      </div>
    </div>

    <!-- Error state -->
    <div v-if="loadError" class="p-6 text-red-600 text-sm">{{ loadError }}</div>

    <!-- Content -->
    <div v-else class="flex flex-1 min-h-0">
      <!-- Spreadsheet (main area) -->
      <div class="flex-1 min-w-0 flex flex-col overflow-hidden">
        <!-- Dual view tabs -->
        <div v-if="hasProcessed" class="flex items-center gap-1 px-4 py-2 bg-gray-50 border-b shrink-0">
          <button
            @click="switchView('raw')"
            :class="[
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              viewMode === 'raw'
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                : 'text-gray-500 hover:text-gray-700'
            ]"
          >
            Raw Data
            <span v-if="viewMode === 'raw'" class="text-xs text-gray-400 ml-1">(read-only)</span>
          </button>
          <button
            @click="switchView('processed')"
            :class="[
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              viewMode === 'processed'
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                : 'text-gray-500 hover:text-gray-700'
            ]"
          >Calculated</button>
          <div class="ml-auto">
            <button
              v-if="viewMode === 'processed'"
              @click="confirmRecalculate"
              class="px-3 py-1.5 text-xs font-medium rounded-md text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
            >Recalculate from Raw</button>
          </div>
        </div>

        <!-- Bootstrap: no calculated file yet -->
        <div v-if="!hasProcessed && hasFormulas" class="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b shrink-0">
          <span class="text-sm text-blue-700">No calculated view yet.</span>
          <button
            @click="confirmRecalculate"
            class="px-3 py-1.5 text-xs font-medium rounded-md text-blue-700 bg-white border border-blue-200 hover:bg-blue-100 transition-colors"
          >Generate Calculated View</button>
        </div>

        <SpreadsheetEditor class="flex-1" />
      </div>

      <!-- Right sidebar -->
      <div class="w-80 shrink-0 border-l border-gray-200 flex flex-col min-h-0 overflow-y-auto">

        <!-- Review Panel -->
        <div class="p-5 border-b border-gray-200 shrink-0 space-y-4">
          <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Review</h3>

          <!-- Current review status badge -->
          <div v-if="currentReview" class="flex items-center gap-2">
            <span class="text-xs font-medium text-gray-500">Current status:</span>
            <span
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
              :class="currentReview.status === 'approved'
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'"
            >
              {{ currentReview.status === 'approved' ? '✓ Approved' : '↩ Changes Requested' }}
            </span>
          </div>
          <div v-else class="text-xs text-gray-400 italic">Not yet reviewed</div>

          <!-- Decision buttons -->
          <div class="flex gap-2">
            <button
              :class="[
                'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                reviewStatus === 'approved'
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-green-700 border-green-300 hover:bg-green-50',
              ]"
              @click="reviewStatus = 'approved'"
            >
              Approve
            </button>
            <button
              :class="[
                'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                reviewStatus === 'changes_requested'
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50',
              ]"
              @click="reviewStatus = 'changes_requested'"
            >
              Request Changes
            </button>
          </div>

          <!-- Comment textarea -->
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Comment (optional)</label>
            <textarea
              v-model="reviewComment"
              rows="4"
              placeholder="Leave a comment for the DevCo…"
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>

          <!-- Feedback -->
          <p v-if="reviewError" class="text-xs text-red-600">{{ reviewError }}</p>
          <p v-if="reviewSuccess" class="text-xs text-green-600">{{ reviewSuccess }}</p>

          <!-- Submit Review button -->
          <button
            :disabled="reviewLoading || !reviewStatus"
            class="w-full py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
            @click="submitReview"
          >
            {{ reviewLoading ? 'Submitting…' : 'Submit Review' }}
          </button>
        </div>

        <!-- AI Fine-Tuning -->
        <div class="flex-1 min-h-0">
          <AIChatPanel
            mode="consolidation-finetune"
            template-id=""
            :consolidated-sheet-id="submissionId"
          />
        </div>
      </div>
    </div>
  </div>
</template>
