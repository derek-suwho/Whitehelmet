<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { useSpreadsheetStore } from '@/stores/spreadsheet'
import SpreadsheetEditor from '@/components/editor/SpreadsheetEditor.vue'
import AIChatPanel from '@/components/template/AIChatPanel.vue'

const route = useRoute()
const router = useRouter()
const spreadsheetStore = useSpreadsheetStore()

const assignmentId = route.params.assignmentId as string
const templateName = ref((route.query.name as string | undefined) ?? 'Template')

const loadError = ref('')
const submitLoading = ref(false)
const submitError = ref('')
const submitSuccess = ref(false)

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

onMounted(async () => {
  try {
    const headers = await getAuthHeader()
    const resp = await fetch(
      `/api/subcontractor/assignments/${assignmentId}/template-download`,
      { headers },
    )
    if (!resp.ok) throw new Error(`Failed to load template (${resp.status})`)
    const buffer = await resp.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellStyles: true })
    spreadsheetStore.loadWorkbook(wb, `${templateName.value}.xlsx`, buffer)
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load template'
  }
})

async function submitFilled() {
  const hot = spreadsheetStore.instance
  if (!hot) { submitError.value = 'Spreadsheet not loaded yet.'; return }

  submitLoading.value = true
  submitError.value = ''

  try {
    const data = hot.getData() as unknown[][]
    const ws = XLSX.utils.aoa_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'ARD')
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    const formData = new FormData()
    formData.append('file', blob, `${templateName.value}.xlsx`)

    const headers = await getAuthHeader()
    const resp = await fetch(
      `/api/subcontractor/assignments/${assignmentId}/submit`,
      { method: 'POST', headers, body: formData },
    )
    if (!resp.ok) {
      const text = await resp.text().catch(() => resp.statusText)
      throw new Error(text)
    }

    submitSuccess.value = true
    setTimeout(() => router.push('/submissions'), 1500)
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : 'Submission failed'
  } finally {
    submitLoading.value = false
  }
}

function goBack() {
  router.push('/submissions')
}
</script>

<template>
  <div class="flex flex-col h-screen pt-14">
    <!-- Top bar -->
    <div class="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
      <div class="flex items-center gap-2 text-sm">
        <button class="text-gray-400 hover:text-gray-600 transition-colors" @click="goBack">
          ← My Assignments
        </button>
        <span class="text-gray-300">/</span>
        <span class="text-gray-800 font-semibold">Fill Template</span>
        <span v-if="templateName" class="text-gray-400 font-normal">— {{ templateName }}</span>
      </div>

      <div class="flex items-center gap-3">
        <span v-if="submitError" class="text-xs text-red-600">{{ submitError }}</span>
        <span v-if="submitSuccess" class="text-xs text-green-600 font-medium">
          Submitted! Redirecting…
        </span>
        <button
          :disabled="submitLoading || submitSuccess"
          class="bg-brand-600 text-white px-5 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
          @click="submitFilled"
        >
          {{ submitLoading ? 'Submitting…' : 'Submit' }}
        </button>
      </div>
    </div>

    <!-- Instruction banner -->
    <div class="px-6 py-2.5 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 shrink-0">
      Fill in your data below, then click <strong>Submit</strong> when ready.
      All changes stay in this editor until you submit — nothing is saved automatically.
    </div>

    <!-- Error state -->
    <div v-if="loadError" class="p-6 text-red-600 text-sm">{{ loadError }}</div>

    <!-- Content: spreadsheet + AI chat -->
    <div v-else class="flex flex-1 min-h-0">
      <!-- Spreadsheet -->
      <div class="flex-1 min-w-0 flex flex-col overflow-hidden">
        <SpreadsheetEditor class="flex-1" />
      </div>

      <!-- AI chat sidebar -->
      <div class="w-80 shrink-0 border-l border-gray-200 flex flex-col min-h-0">
        <AIChatPanel
          mode="consolidation-finetune"
          template-id=""
          :consolidated-sheet-id="assignmentId"
        />
      </div>
    </div>
  </div>
</template>
