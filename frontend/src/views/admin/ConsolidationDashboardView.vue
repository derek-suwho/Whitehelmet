<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/composables/useApi'
import { useTemplatesStore } from '@/stores/templates'
import ConsolidationStatusModal from './modals/ConsolidationStatusModal.vue'
import SubmissionTracker from '@/components/admin/SubmissionTracker.vue'

const route = useRoute()
const router = useRouter()
const templatesStore = useTemplatesStore()

interface OrgStatus {
  org_id: string
  org_name: string
  assignment_id: string | null
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

interface TemplateOverview {
  template_id: string
  template_name: string
  total_members: number
  submitted_count: number
  all_submitted: boolean
}

interface ProjectOverview {
  total_members: number
  total_expected: number
  total_submitted: number
  all_submitted: boolean
  templates: TemplateOverview[]
}

const templateId = route.params.templateId as string
const projectId = route.query.project_id as string | undefined
const selectedTemplateId = ref(templateId)

const allSubmitted = ref(false)
const progressData = ref<ProgressData | null>(null)
const projectOverview = ref<ProjectOverview | null>(null)
const selectedSubmissionIds = ref<string[]>([])
const consolidating = ref(false)
const consolidationResult = ref<{
  consolidated_sheet_id: string
  file_path: string
  freeform_count: number
  template_count: number
  name: string | null
  period: string | null
} | null>(null)
const consolidationError = ref('')
const showStatusModal = ref(false)
const reportName = ref('')
const reportPeriod = ref('')

const canConsolidate = computed(() => {
  if (consolidating.value) return false
  if (!progressData.value) return false
  return progressData.value.orgs.some(o => o.submission_id !== null)
})

const consolidateLabel = computed(() => {
  if (consolidating.value) return 'Consolidating…'
  if (projectId) {
    const count = selectedSubmissionIds.value.length
    return count > 0 ? `Consolidate ${count} Selected` : 'Consolidate All'
  }
  return 'Consolidate All'
})

const overallPct = computed(() => {
  if (!projectOverview.value || projectOverview.value.total_expected === 0) return 0
  return Math.round((projectOverview.value.total_submitted / projectOverview.value.total_expected) * 100)
})

onMounted(() => {
  templatesStore.fetchTemplate(templateId)
  fetchProgress()
  if (projectId) fetchProjectOverview()
})

async function fetchProgress() {
  try {
    const tid = selectedTemplateId.value
    const url = projectId
      ? `/api/admin/templates/${tid}/consolidation-progress?project_id=${projectId}`
      : `/api/admin/templates/${tid}/consolidation-progress`
    progressData.value = await api.get<ProgressData>(url)
    if (progressData.value?.all_submitted) allSubmitted.value = true
  } catch { /* non-fatal */ }
}

async function selectTemplate(id: string) {
  if (selectedTemplateId.value === id) return
  selectedTemplateId.value = id
  selectedSubmissionIds.value = []
  progressData.value = null
  await fetchProgress()
}

async function fetchProjectOverview() {
  try {
    projectOverview.value = await api.get<ProjectOverview>(
      `/api/admin/projects/${projectId}/submission-overview`
    )
  } catch { /* non-fatal */ }
}

function onAllSubmitted() { allSubmitted.value = true }

async function consolidate() {
  consolidating.value = true
  consolidationError.value = ''
  consolidationResult.value = null
  showStatusModal.value = true
  try {
    let submissionIds: string[] | null = null

    if (projectId) {
      submissionIds = selectedSubmissionIds.value.length > 0
        ? selectedSubmissionIds.value
        : null
    } else {
      const ids = (progressData.value?.orgs ?? [])
        .map(o => o.submission_id)
        .filter((id): id is string => id !== null)
      if (ids.length === 0) throw new Error('No submitted files to consolidate')
      submissionIds = ids
    }

    const data = await api.post<typeof consolidationResult.value>(
      `/api/admin/templates/${selectedTemplateId.value}/consolidate-submissions`,
      {
        project_id: projectId ?? null,
        submission_ids: submissionIds,
        name: reportName.value.trim() || null,
        period: reportPeriod.value.trim() || null,
      },
    )

    consolidationResult.value = data
  } catch (e) {
    consolidationError.value = e instanceof Error ? e.message : 'Consolidation failed'
  } finally {
    consolidating.value = false
  }
}

function openMasterSheet() {
  if (!consolidationResult.value) return
  const sheetId = consolidationResult.value.consolidated_sheet_id
  const query: Record<string, string> = { template_id: selectedTemplateId.value }
  if (projectId) query.project_id = projectId
  if (selectedSubmissionIds.value.length > 0) {
    query.submission_ids = selectedSubmissionIds.value.join(',')
  }
  router.push({ name: 'admin-master-sheet', params: { sheetId }, query })
}

async function download() {
  if (!consolidationResult.value) return
  const url = await templatesStore.getDownloadUrl(consolidationResult.value.consolidated_sheet_id)
  window.open(url, '_blank')
}
</script>

<template>
  <div class="p-6 space-y-6 overflow-y-auto flex-1 min-h-0">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <RouterLink to="/admin/templates" class="text-gray-400 hover:text-gray-600 text-sm">← Templates</RouterLink>
        <h1 class="text-xl font-semibold text-gray-800 mt-1">
          Consolidation — {{ templatesStore.currentTemplate?.name ?? '…' }}
        </h1>
        <p v-if="projectId" class="text-xs text-gray-400 mt-0.5">
          Showing subcontractors from this project.
          {{ selectedSubmissionIds.length > 0 ? `${selectedSubmissionIds.length} selected.` : 'Select rows to consolidate a subset, or consolidate all.' }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <input
          v-model="reportPeriod"
          placeholder="Period (e.g. 2026-07)"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <input
          v-model="reportName"
          placeholder="Report name (optional)"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <button
          :disabled="!canConsolidate"
          class="bg-green-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          :title="!canConsolidate && !consolidating ? 'No submitted files to consolidate' : ''"
          @click="consolidate"
        >
          {{ consolidateLabel }}
        </button>
      </div>
    </div>

    <!-- Overall cross-template progress (project scope only) -->
    <div v-if="projectId && projectOverview" class="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold text-gray-700">Overall Submission Progress</span>
        <span :class="projectOverview.all_submitted ? 'text-green-600' : 'text-gray-500'" class="text-sm font-medium">
          {{ projectOverview.total_submitted }} / {{ projectOverview.total_expected }} submitted
        </span>
      </div>
      <div class="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-500"
          :class="projectOverview.all_submitted ? 'bg-green-500' : 'bg-blue-500'"
          :style="{ width: overallPct + '%' }"
        />
      </div>
      <p class="text-xs text-gray-400">
        {{ projectOverview.total_members }} subcontractor{{ projectOverview.total_members !== 1 ? 's' : '' }}
        × {{ projectOverview.templates.length }} template{{ projectOverview.templates.length !== 1 ? 's' : '' }}
      </p>
    </div>
    <div v-else-if="projectId && !projectOverview" class="h-16 animate-pulse rounded-xl border border-gray-200 bg-white" />

    <!-- Per-template breakdown -->
    <div v-if="projectId && projectOverview && projectOverview.templates.length > 0" class="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div class="px-5 py-3 border-b border-gray-100">
        <span class="text-sm font-semibold text-gray-700">Templates</span>
      </div>
      <div class="divide-y divide-gray-100">
        <button
          v-for="t in projectOverview.templates"
          :key="t.template_id"
          class="w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-gray-50"
          :class="selectedTemplateId === t.template_id ? 'bg-gray-50' : ''"
          @click="selectTemplate(t.template_id)"
        >
          <!-- Radio / checkmark -->
          <div class="shrink-0">
            <svg v-if="t.all_submitted && selectedTemplateId === t.template_id"
              class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
            </svg>
            <svg v-else-if="t.all_submitted"
              class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
            </svg>
            <div v-else
              class="w-4 h-4 rounded-full border-2 transition-colors"
              :class="selectedTemplateId === t.template_id ? 'border-violet-500' : 'border-gray-300'"
            />
          </div>
          <!-- Name -->
          <span class="text-sm font-medium flex-1 truncate"
            :class="selectedTemplateId === t.template_id ? 'text-gray-900' : 'text-gray-600'">
            {{ t.template_name }}
          </span>
          <!-- Mini bar + count -->
          <div class="w-36 shrink-0">
            <div class="flex items-center gap-2">
              <div class="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="t.all_submitted ? 'bg-green-500' : 'bg-blue-400'"
                  :style="{ width: t.total_members > 0 ? Math.round((t.submitted_count / t.total_members) * 100) + '%' : '0%' }"
                />
              </div>
              <span class="text-xs text-gray-400 whitespace-nowrap shrink-0">{{ t.submitted_count }}/{{ t.total_members }}</span>
            </div>
          </div>
        </button>
      </div>
    </div>

    <!-- This template's submissions -->
    <SubmissionTracker
      v-if="progressData"
      :progress="progressData"
      :selectable="!!projectId"
      v-model:selected="selectedSubmissionIds"
      @all-submitted="onAllSubmitted"
    />
    <div v-else class="h-20 animate-pulse rounded-xl border border-gray-200 bg-white" />

  </div>

  <ConsolidationStatusModal
    :open="showStatusModal"
    :loading="consolidating"
    :result="consolidationResult"
    :error="consolidationError"
    @close="showStatusModal = false"
    @download="download"
    @open-master="openMasterSheet"
  />
</template>
