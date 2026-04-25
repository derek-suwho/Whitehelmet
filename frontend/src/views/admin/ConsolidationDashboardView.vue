<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useTemplatesStore } from '@/stores/templates'
import AIChatPanel from '@/components/template/AIChatPanel.vue'
import ConsolidationStatusModal from './modals/ConsolidationStatusModal.vue'
import SpreadsheetEditor from '@/components/editor/SpreadsheetEditor.vue'

const route = useRoute()
const templatesStore = useTemplatesStore()

const templateId = route.params.templateId as string
const allSubmitted = ref(false)
const consolidating = ref(false)
const consolidationResult = ref<{
  consolidated_sheet_id: string
  file_path: string
  freeform_count: number
  template_count: number
} | null>(null)
const consolidationError = ref('')
const showStatusModal = ref(false)
const masterSheetData = ref(null)
const consolidatedSheetId = ref('')

onMounted(() => templatesStore.fetchTemplate(templateId))

function onAllSubmitted() {
  allSubmitted.value = true
}

async function consolidate() {
  if (!templatesStore.currentVersion) return
  consolidating.value = true
  consolidationError.value = ''
  consolidationResult.value = null
  showStatusModal.value = true

  try {
    const { data: submissions } = await supabase
      .from('submissions')
      .select('id')
      .eq('status', 'locked')

    const submissionIds = (submissions ?? []).map((s: { id: string }) => s.id)

    const { data, error } = await supabase.functions.invoke('g2-consolidate', {
      body: {
        template_id: templateId,
        template_version_id: templatesStore.currentVersion.id,
        submission_ids: submissionIds,
      },
    })
    if (error) throw error

    consolidationResult.value = data
    consolidatedSheetId.value = data.consolidated_sheet_id
  } catch (e) {
    consolidationError.value = e instanceof Error ? e.message : 'Consolidation failed'
  } finally {
    consolidating.value = false
  }
}

async function download() {
  if (!consolidationResult.value) return
  const url = await templatesStore.getDownloadUrl(consolidationResult.value.file_path)
  window.open(url, '_blank')
}

function onFinetuneApplied() {
  // Re-load the master sheet preview
  templatesStore.fetchConsolidatedSheets(templateId)
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

    <!-- Submission tracking (Group 1 component will go here) -->
    <div class="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-500">
      SubmissionTrackingView (Group 1) will be embedded here — listening for @all-submitted event.
      <br />
      <button class="mt-2 text-xs text-blue-600 hover:underline" @click="onAllSubmitted">
        [Dev: simulate all-submitted]
      </button>
    </div>

    <!-- Post-consolidation: preview + AI fine-tune -->
    <div v-if="consolidationResult" class="flex gap-4 h-[500px]">
      <div class="flex-1 border border-gray-200 rounded-xl overflow-hidden">
        <SpreadsheetEditor :model-value="masterSheetData" :readonly="true" />
      </div>
      <div class="w-80 shrink-0 border border-gray-200 rounded-xl overflow-hidden">
        <AIChatPanel
          mode="consolidation-finetune"
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
