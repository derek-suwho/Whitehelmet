<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { api } from '@/composables/useApi'
import { useAdminStore } from '@/stores/admin'
import { useTemplatesStore } from '@/stores/templates'
import { useFormulasStore } from '@/stores/formulas'
import type { ProjectDetail, MasterReport, ProjectSubmission } from '@/stores/admin'
import type { ProjectMember } from '@/types/database'

const route = useRoute()
const adminStore = useAdminStore()
const templatesStore = useTemplatesStore()
const formulasStore = useFormulasStore()

const projectId = route.params.projectId as string
const project = ref<ProjectDetail | null>(null)
const loading = ref(true)
const error = ref('')

const tabs = [
  { key: 'workpackage',   label: 'Work Package' },
  { key: 'document',      label: 'Document Management' },
  { key: 'template',      label: 'Subcontractor Templates' },
  { key: 'subcontractor', label: 'Sub-Contractor Record' },
  { key: 'consolidated',  label: 'Auto-Consolidated Master Records' },
  { key: 'formulas',      label: 'Formulas' },
  { key: 'notifications', label: 'Notifications' },
] as const
type TabKey = typeof tabs[number]['key']
const activeTab = ref<TabKey>('workpackage')

// Add member modal
const showMemberModal = ref(false)
const memberUserId = ref<number | null>(null)
const memberParticipantRole = ref<'focal' | 'member' | 'viewer'>('focal')
const addingMember = ref(false)
const memberError = ref('')

// Assign template modal
const showTemplateModal = ref(false)
const selectedTemplateId = ref('')
const selectedVersionId = ref('')
const templateDeadline = ref('')
const selectedMemberIds = ref<number[]>([])
const assigningTemplate = ref(false)
const templateError = ref('')

// Upload xlsx template
const showUploadModal = ref(false)
const uploadTemplateName = ref('')
const uploadTemplateFile = ref<File | null>(null)
const uploadingTemplate = ref(false)
const uploadTemplateError = ref('')
const uploadTemplateSuccess = ref('')

async function handleTemplateFileChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null
  uploadTemplateFile.value = f
  if (f && !uploadTemplateName.value) {
    uploadTemplateName.value = f.name.replace(/\.xlsx?$/i, '').replace(/_/g, ' ')
  }
}

async function uploadXlsxTemplate() {
  if (!uploadTemplateName.value.trim()) { uploadTemplateError.value = 'Enter a template name.'; return }
  if (!uploadTemplateFile.value) { uploadTemplateError.value = 'Select an xlsx file.'; return }
  uploadingTemplate.value = true
  uploadTemplateError.value = ''
  uploadTemplateSuccess.value = ''
  try {
    const { supabase } = await import('@/lib/supabase')
    const { data: { session } } = await supabase.auth.getSession()
    const headers: Record<string, string> = session ? { Authorization: `Bearer ${session.access_token}` } : {}
    const form = new FormData()
    form.append('file', uploadTemplateFile.value)
    const resp = await fetch(
      `/api/templates/upload-xlsx?name=${encodeURIComponent(uploadTemplateName.value.trim())}`,
      { method: 'POST', headers, body: form },
    )
    if (!resp.ok) { const t = await resp.text(); throw new Error(t) }
    uploadTemplateSuccess.value = 'Template uploaded! You can now assign it to members.'
    uploadTemplateName.value = ''
    uploadTemplateFile.value = null
    await templatesStore.fetchTemplates()
  } catch (e) {
    uploadTemplateError.value = e instanceof Error ? e.message : 'Upload failed'
  } finally {
    uploadingTemplate.value = false
  }
}

// Formula management
const showFormulaForm = ref(false)
const newFormula = ref({ name: '', expression: '', description: '', formula_type: 'calculation' })
const newFormulaParamInput = ref('')
const newFormulaParams = ref<string[]>([])
const addingFormula = ref(false)
const formulaError = ref('')

function addParam() {
  const val = newFormulaParamInput.value.trim().replace(/[^a-zA-Z0-9_]/g, '_')
  if (val && !newFormulaParams.value.includes(val)) newFormulaParams.value.push(val)
  newFormulaParamInput.value = ''
}

function removeParam(p: string) {
  newFormulaParams.value = newFormulaParams.value.filter(x => x !== p)
}

async function addFormula() {
  if (!newFormula.value.name.trim() || !newFormula.value.expression.trim()) {
    formulaError.value = 'Name and expression are required.'
    return
  }
  addingFormula.value = true
  formulaError.value = ''
  try {
    await formulasStore.saveFormula({
      ...newFormula.value,
      parameters: newFormulaParams.value.length ? [...newFormulaParams.value] : undefined,
    })
    newFormula.value = { name: '', expression: '', description: '', formula_type: 'calculation' }
    newFormulaParams.value = []
    newFormulaParamInput.value = ''
    showFormulaForm.value = false
  } catch (e) {
    formulaError.value = e instanceof Error ? e.message : 'Failed to save formula'
  } finally {
    addingFormula.value = false
  }
}

// Master template
const showMasterModal = ref(false)
const selectedMasterTemplateId = ref('')
const settingMaster = ref(false)
const masterError = ref('')
const masterTemplates = computed(() =>
  templatesStore.templates.filter(t => t.template_type === 'master')
)

// Master reports list
const masterReports = ref<MasterReport[]>([])
const loadingReports = ref(false)
const renamingId = ref<string | null>(null)
const renameValue = ref('')

async function loadMasterReports() {
  loadingReports.value = true
  try {
    masterReports.value = await adminStore.fetchMasterReports(projectId)
  } finally {
    loadingReports.value = false
  }
}

function startRename(r: MasterReport) {
  renamingId.value = r.id
  renameValue.value = r.name ?? ''
}

async function saveRename(r: MasterReport) {
  if (!renameValue.value.trim()) { renamingId.value = null; return }
  await adminStore.renameMasterReport(r.id, renameValue.value.trim())
  renamingId.value = null
  await loadMasterReports()
}

async function deleteReport(r: MasterReport) {
  if (!confirm(`Delete "${r.name ?? r.id}"? This cannot be undone.`)) return
  await adminStore.deleteMasterReport(r.id)
  await loadMasterReports()
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// Template search
const templateSearch = ref('')
const filteredAssignments = computed(() => {
  const q = templateSearch.value.toLowerCase()
  if (!q) return project.value?.template_assignments ?? []
  return (project.value?.template_assignments ?? []).filter(a =>
    (a.template_name ?? '').toLowerCase().includes(q)
  )
})

// Submission progress per template
interface TemplateProgress { template_id: string; submitted_count: number; total_members: number; all_submitted: boolean }
const templateProgress = ref<TemplateProgress[]>([])

async function loadSubmissionOverview() {
  try {
    const data = await api.get<{ templates: TemplateProgress[] }>(
      `/api/admin/projects/${projectId}/submission-overview`
    )
    templateProgress.value = data.templates ?? []
  } catch { /* non-fatal */ }
}

function progressForTemplate(templateId: string | null): TemplateProgress | null {
  if (!templateId) return null
  return templateProgress.value.find(p => p.template_id === templateId) ?? null
}

// Subcontractor submissions
const submissions = ref<ProjectSubmission[]>([])
const loadingSubmissions = ref(false)
const submissionSearch = ref('')
const dateFrom = ref('')
const dateTo = ref('')

async function loadSubmissions() {
  loadingSubmissions.value = true
  try {
    submissions.value = await adminStore.fetchProjectSubmissions(projectId)
  } finally {
    loadingSubmissions.value = false
  }
}

const filteredSubmissions = computed(() => {
  let list = submissions.value
  const q = submissionSearch.value.toLowerCase()
  if (q) list = list.filter(s =>
    s.file_name.toLowerCase().includes(q) ||
    s.submitter_name.toLowerCase().includes(q) ||
    (s.reporting_period ?? '').toLowerCase().includes(q)
  )
  if (dateFrom.value) list = list.filter(s => s.submitted_at && s.submitted_at >= dateFrom.value)
  if (dateTo.value)   list = list.filter(s => s.submitted_at && s.submitted_at <= dateTo.value + 'T23:59:59')
  return list
})

onMounted(async () => {
  try {
    await Promise.all([
      loadProject(),
      adminStore.fetchUsers(),
      templatesStore.fetchTemplates(),
      loadMasterReports(),
      loadSubmissions(),
      loadSubmissionOverview(),
      formulasStore.fetchFormulas(),
    ])
  } finally {
    loading.value = false
  }
})

async function loadProject() {
  project.value = await adminStore.fetchProjectDetail(projectId)
}

function availableUsers() {
  const memberIds = new Set((project.value?.members ?? []).map(m => m.user_id))
  return adminStore.users.filter(u => !memberIds.has(u.id))
}

function versionsForTemplate() {
  if (!selectedTemplateId.value) return []
  return templatesStore.versions
}

function openTemplateModal() {
  selectedTemplateId.value = ''
  selectedVersionId.value = ''
  templateDeadline.value = ''
  selectedMemberIds.value = []
  templateError.value = ''
  showTemplateModal.value = true
}

async function addMember() {
  if (!memberUserId.value) { memberError.value = 'Select a user.'; return }
  addingMember.value = true
  memberError.value = ''
  try {
    await adminStore.addProjectMember(projectId, memberUserId.value, memberParticipantRole.value)
    await loadProject()
    showMemberModal.value = false
    memberUserId.value = null
    memberParticipantRole.value = 'focal'
  } catch (e) {
    memberError.value = e instanceof Error ? e.message : 'Failed'
  } finally {
    addingMember.value = false
  }
}

async function removeMember(m: ProjectMember) {
  try {
    await adminStore.removeProjectMember(projectId, m.membership_id)
    await loadProject()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to remove member'
  }
}

async function assignTemplate() {
  if (!selectedVersionId.value) { templateError.value = 'Select a template version.'; return }
  assigningTemplate.value = true
  templateError.value = ''
  try {
    await adminStore.assignTemplateToProject(
      projectId,
      selectedVersionId.value,
      templateDeadline.value || undefined,
      selectedMemberIds.value.length ? selectedMemberIds.value : undefined,
    )
    await loadProject()
    showTemplateModal.value = false
  } catch (e) {
    templateError.value = e instanceof Error ? e.message : 'Failed'
  } finally {
    assigningTemplate.value = false
  }
}

function openMasterModal() {
  selectedMasterTemplateId.value = project.value?.master_template_id ?? ''
  masterError.value = ''
  showMasterModal.value = true
}

async function setMasterTemplate(templateId: string | null) {
  settingMaster.value = true
  masterError.value = ''
  try {
    project.value = await adminStore.setProjectMasterTemplate(projectId, templateId)
    showMasterModal.value = false
  } catch (e) {
    masterError.value = e instanceof Error ? e.message : 'Failed'
  } finally {
    settingMaster.value = false
  }
}

async function onTemplateChange() {
  selectedVersionId.value = ''
  if (selectedTemplateId.value) {
    try {
      await templatesStore.fetchTemplate(selectedTemplateId.value)
    } catch (e) {
      console.error('Failed to load template versions:', e)
    }
  }
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden bg-gray-50">

    <!-- Page header -->
    <div class="bg-white border-b border-gray-200 px-8 pt-5 pb-0 shrink-0">
      <RouterLink to="/admin/projects" class="text-sm text-gray-400 hover:text-gray-600 transition-colors">
        ← Projects
      </RouterLink>

      <div class="flex items-start justify-between mt-3 mb-5">
        <div>
          <div v-if="loading" class="h-8 w-56 animate-pulse rounded bg-gray-200" />
          <h1 v-else class="text-2xl font-bold text-gray-900">Reporting Data</h1>
          <p v-if="project?.name" class="text-sm text-gray-500 mt-0.5">{{ project.name }}</p>
        </div>

        <!-- Export Report View -->
        <button class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Export Report View
        </button>
      </div>

      <!-- Tab bar -->
      <nav class="flex -mb-px overflow-x-auto">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="shrink-0 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors"
          :class="activeTab === tab.key
            ? 'border-violet-600 text-violet-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
          @click="activeTab = tab.key"
        >{{ tab.label }}</button>
      </nav>
    </div>

    <div v-if="error" class="mx-8 mt-4 text-sm text-red-600">{{ error }}</div>

    <!-- Tab content -->
    <div class="flex-1 overflow-auto p-8">

      <!-- ── Work Package (blank / TODO) ── -->
      <template v-if="activeTab === 'workpackage'">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-base font-semibold text-gray-800">All Work Packages (0)</h2>
          <div class="flex items-center gap-3">
            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
              </svg>
              <input
                disabled
                placeholder="Search"
                class="rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm w-56 text-gray-500 cursor-not-allowed"
              />
            </div>
            <button class="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-500 hover:bg-gray-50">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M7 8h10M11 12h4"/>
              </svg>
            </button>
            <button disabled class="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white opacity-50 cursor-not-allowed">
              + Add New Work Package
            </button>
          </div>
        </div>

        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 bg-gray-50">
                <th class="px-5 py-3 text-left text-xs font-medium text-gray-500">Work Order No.</th>
                <th class="px-5 py-3 text-left text-xs font-medium text-gray-500">
                  Contract Name
                  <svg class="inline ml-1 h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
                  </svg>
                </th>
                <th class="px-5 py-3 text-left text-xs font-medium text-gray-500">Contractor</th>
                <th class="px-5 py-3 text-left text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="4" class="py-20 text-center">
                  <!-- Empty state illustration -->
                  <div class="flex flex-col items-center gap-3">
                    <svg width="120" height="90" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <ellipse cx="60" cy="75" rx="40" ry="6" fill="#EDE9FE"/>
                      <rect x="20" y="30" width="60" height="8" rx="4" fill="#C4B5FD"/>
                      <rect x="28" y="44" width="44" height="8" rx="4" fill="#DDD6FE"/>
                      <rect x="10" y="58" width="70" height="8" rx="4" fill="#EDE9FE"/>
                      <circle cx="72" cy="36" r="22" fill="#7C3AED"/>
                      <circle cx="72" cy="36" r="14" fill="white" fill-opacity="0.15"/>
                      <circle cx="72" cy="36" r="10" stroke="white" stroke-width="2.5" fill="none"/>
                      <path d="M79 43l6 6" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                      <circle cx="44" cy="22" r="4" fill="#C4B5FD"/>
                      <circle cx="100" cy="52" r="5" fill="#DDD6FE"/>
                      <circle cx="18" cy="48" r="3" fill="#EDE9FE"/>
                    </svg>
                    <p class="text-sm text-gray-400">No Data to Show</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- ── Document Management (TODO) ── -->
      <template v-else-if="activeTab === 'document'">
        <div class="flex flex-col items-center justify-center py-24 text-center">
          <div class="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <p class="text-sm font-medium text-gray-600">Document Management</p>
          <p class="text-xs text-gray-400 mt-1">TODO — coming soon</p>
        </div>
      </template>

      <!-- ── Template ── -->
      <template v-else-if="activeTab === 'template'">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-base font-semibold text-gray-800">
            Subcontractor Templates ({{ project?.template_assignments?.length ?? 0 }})
          </h2>
          <div class="flex items-center gap-3">
            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
              </svg>
              <input
                v-model="templateSearch"
                placeholder="Search"
                class="rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <button
              class="flex items-center gap-1.5 rounded-lg border border-violet-400 text-violet-700 px-4 py-2 text-sm font-medium hover:bg-violet-50 transition-colors"
              @click="showUploadModal = true; uploadTemplateError = ''; uploadTemplateSuccess = ''"
            >
              ↑ Upload KPI Template
            </button>
            <button
              class="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
              @click="openTemplateModal"
            >
              + Assign Template
            </button>
          </div>
        </div>

        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 bg-gray-50">
                <th class="px-5 py-3 text-left text-xs font-medium text-gray-500">Template Name</th>
                <th class="px-5 py-3 text-left text-xs font-medium text-gray-500">Assigned To</th>
                <th class="px-5 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th class="px-5 py-3 text-left text-xs font-medium text-gray-500">Deadline</th>
                <th class="px-5 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr
                v-for="a in filteredAssignments"
                :key="a.assignment_id"
                class="hover:bg-gray-50 transition-colors"
              >
                <td class="px-5 py-3.5 font-medium text-gray-800">{{ a.template_name ?? a.template_version_id ?? '—' }}</td>
                <td class="px-5 py-3.5 text-gray-500 text-xs">{{ a.assigned_to_display ?? 'All members' }}</td>
                <td class="px-5 py-3.5">
                  <template v-if="!a.assigned_to_display && progressForTemplate(a.template_id)">
                    <div class="flex items-center gap-2 min-w-[120px]">
                      <div class="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          class="h-full rounded-full transition-all duration-500"
                          :class="progressForTemplate(a.template_id)!.all_submitted ? 'bg-green-500' : 'bg-violet-500'"
                          :style="{ width: progressForTemplate(a.template_id)!.total_members > 0
                            ? Math.round((progressForTemplate(a.template_id)!.submitted_count / progressForTemplate(a.template_id)!.total_members) * 100) + '%'
                            : '0%' }"
                        />
                      </div>
                      <span class="text-xs text-gray-500 whitespace-nowrap shrink-0">
                        {{ progressForTemplate(a.template_id)!.submitted_count }}/{{ progressForTemplate(a.template_id)!.total_members }}
                      </span>
                    </div>
                  </template>
                  <span v-else class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium"
                    :class="{
                      'bg-amber-100 text-amber-700': a.status === 'pending',
                      'bg-green-100 text-green-700': a.status === 'submitted',
                      'bg-gray-100 text-gray-500':   a.status === 'locked',
                    }">{{ a.status }}</span>
                </td>
                <td class="px-5 py-3.5 text-gray-500">{{ formatDate(a.deadline) }}</td>
                <td class="px-5 py-3.5 flex items-center gap-3">
                  <RouterLink
                    v-if="a.template_id"
                    :to="`/admin/templates/${a.template_id}/edit`"
                    class="text-xs text-violet-600 hover:text-violet-800 hover:underline"
                  >Edit</RouterLink>
                  <RouterLink
                    v-if="a.template_id"
                    :to="`/admin/consolidations/${a.template_id}`"
                    class="text-xs font-medium text-green-600 hover:text-green-800 hover:underline"
                  >Consolidate →</RouterLink>
                </td>
              </tr>
              <tr v-if="!filteredAssignments.length">
                <td colspan="5" class="py-20 text-center">
                  <div class="flex flex-col items-center gap-3">
                    <svg width="120" height="90" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <ellipse cx="60" cy="75" rx="40" ry="6" fill="#EDE9FE"/>
                      <rect x="20" y="30" width="60" height="8" rx="4" fill="#C4B5FD"/>
                      <rect x="28" y="44" width="44" height="8" rx="4" fill="#DDD6FE"/>
                      <rect x="10" y="58" width="70" height="8" rx="4" fill="#EDE9FE"/>
                      <circle cx="72" cy="36" r="22" fill="#7C3AED"/>
                      <circle cx="72" cy="36" r="14" fill="white" fill-opacity="0.15"/>
                      <circle cx="72" cy="36" r="10" stroke="white" stroke-width="2.5" fill="none"/>
                      <path d="M79 43l6 6" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                      <circle cx="44" cy="22" r="4" fill="#C4B5FD"/>
                      <circle cx="100" cy="52" r="5" fill="#DDD6FE"/>
                      <circle cx="18" cy="48" r="3" fill="#EDE9FE"/>
                    </svg>
                    <p class="text-sm text-gray-400">No Data to Show</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- ── Sub-Contractor Record ── -->
      <template v-else-if="activeTab === 'subcontractor'">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-base font-semibold text-gray-800">
            All Records ({{ filteredSubmissions.length }})
          </h2>
          <div class="flex items-center gap-2">
            <!-- Search -->
            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
              </svg>
              <input
                v-model="submissionSearch"
                placeholder="Search"
                class="rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <!-- Date range -->
            <div class="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2">
              <input
                v-model="dateFrom"
                type="date"
                class="text-sm text-gray-500 bg-transparent focus:outline-none w-32"
                placeholder="Start Date"
              />
              <span class="text-gray-300 mx-1">–</span>
              <input
                v-model="dateTo"
                type="date"
                class="text-sm text-gray-500 bg-transparent focus:outline-none w-32"
                placeholder="End Date"
              />
              <svg class="h-4 w-4 text-gray-400 ml-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <!-- Filter icon -->
            <button class="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-500 hover:bg-gray-50">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M7 8h10M11 12h4"/>
              </svg>
            </button>
            <!-- Add -->
            <button
              class="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
              @click="showMemberModal = true"
            >
              + Add New Record
            </button>
          </div>
        </div>

        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div v-if="loadingSubmissions" class="py-10 text-center text-sm text-gray-400">Loading…</div>
          <table v-else class="min-w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 bg-gray-50">
                <th class="w-10 px-4 py-3">
                  <input type="checkbox" class="rounded border-gray-300" />
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">ID</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  Name
                  <svg class="inline ml-1 h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
                  </svg>
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">Contractor</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">Period</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">Date Added</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">Last Edit Date</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  Status
                  <svg class="inline ml-1 h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
                  </svg>
                </th>
                <th class="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr
                v-for="s in filteredSubmissions"
                :key="s.id"
                class="hover:bg-gray-50 transition-colors"
              >
                <td class="px-4 py-3.5 text-center">
                  <input type="checkbox" class="rounded border-gray-300" />
                </td>
                <td class="px-4 py-3.5 text-gray-500 text-xs font-mono">{{ s.row_number }}</td>
                <td class="px-4 py-3.5 font-medium text-gray-800 max-w-xs">
                  <span class="block truncate" :title="s.file_name">{{ s.file_name }}</span>
                </td>
                <td class="px-4 py-3.5">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    {{ s.submitter_name }}
                  </span>
                </td>
                <td class="px-4 py-3.5 text-gray-500 text-xs">{{ s.reporting_period ?? '—' }}</td>
                <td class="px-4 py-3.5 text-gray-500 text-xs">
                  {{ s.submitted_at ? new Date(s.submitted_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—' }}
                </td>
                <td class="px-4 py-3.5 text-gray-500 text-xs">
                  {{ s.submitted_at ? new Date(s.submitted_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—' }}
                </td>
                <td class="px-4 py-3.5">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium"
                      :class="s.status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
                      {{ s.status.charAt(0).toUpperCase() + s.status.slice(1) }}
                    </span>
                    <span v-if="s.review_status === 'approved'"
                      class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      ✓ Approved
                    </span>
                    <span v-else-if="s.review_status === 'changes_requested'"
                      class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      ↩ Changes
                    </span>
                  </div>
                </td>
                <td class="px-4 py-3.5 text-center">
                  <RouterLink
                    :to="`/admin/submissions/${s.id}/review?fileName=${encodeURIComponent(s.file_name)}`"
                    class="text-gray-400 hover:text-gray-600 transition-colors"
                    title="Review submission"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                  </RouterLink>
                </td>
              </tr>
              <tr v-if="!filteredSubmissions.length">
                <td colspan="9" class="py-20 text-center">
                  <div class="flex flex-col items-center gap-3">
                    <svg width="120" height="90" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <ellipse cx="60" cy="75" rx="40" ry="6" fill="#EDE9FE"/>
                      <rect x="20" y="30" width="60" height="8" rx="4" fill="#C4B5FD"/>
                      <rect x="28" y="44" width="44" height="8" rx="4" fill="#DDD6FE"/>
                      <rect x="10" y="58" width="70" height="8" rx="4" fill="#EDE9FE"/>
                      <circle cx="72" cy="36" r="22" fill="#7C3AED"/>
                      <circle cx="72" cy="36" r="14" fill="white" fill-opacity="0.15"/>
                      <circle cx="72" cy="36" r="10" stroke="white" stroke-width="2.5" fill="none"/>
                      <path d="M79 43l6 6" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                      <circle cx="44" cy="22" r="4" fill="#C4B5FD"/>
                      <circle cx="100" cy="52" r="5" fill="#DDD6FE"/>
                      <circle cx="18" cy="48" r="3" fill="#EDE9FE"/>
                    </svg>
                    <p class="text-sm text-gray-400">No Data to Show</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- ── Auto-Consolidated Master Records ── -->
      <template v-else-if="activeTab === 'consolidated'">
        <!-- Master template card -->
        <div class="bg-white rounded-xl border overflow-hidden mb-6"
          :class="project?.master_template_id ? 'border-violet-300' : 'border-gray-200'">
          <div class="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <div class="flex items-center gap-2">
              <svg class="h-4 w-4 text-violet-500" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/>
              </svg>
              <h2 class="text-sm font-semibold text-gray-700">Master Template</h2>
            </div>
            <button class="text-sm text-violet-600 hover:underline" @click="openMasterModal">
              {{ project?.master_template_id ? 'Change' : 'Assign' }}
            </button>
          </div>
          <div class="px-5 py-4">
            <div v-if="project?.master_template_id" class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-800">{{ project.master_template_name ?? project.master_template_id }}</p>
                <p class="text-xs text-gray-400 mt-0.5">Consolidated output schema for this project</p>
              </div>
              <div class="flex items-center gap-4">
                <RouterLink
                  :to="`/admin/templates/${project.master_template_id}/edit`"
                  class="text-xs text-violet-600 hover:underline"
                >Edit</RouterLink>
                <RouterLink
                  :to="`/admin/consolidations/${project.master_template_id}?project_id=${project.id}`"
                  class="text-xs font-medium text-green-600 hover:underline"
                >Consolidate →</RouterLink>
                <RouterLink
                  v-if="project.master_template_id"
                  :to="`/admin/master-sheets/${project.master_template_id}`"
                  class="text-xs font-medium text-blue-600 hover:underline"
                >View Master Sheet →</RouterLink>
                <button class="text-xs text-gray-400 hover:text-red-500 transition-colors" @click="setMasterTemplate(null)">Remove</button>
              </div>
            </div>
            <p v-else class="text-sm text-gray-400">
              No master template assigned. Assign one to define the consolidated output structure for this project.
            </p>
          </div>
        </div>

        <!-- Master reports list -->
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-base font-semibold text-gray-800">
            Auto-Consolidated Records ({{ masterReports.length }})
          </h2>
          <RouterLink
            v-if="project?.master_template_id"
            :to="`/admin/consolidations/${project.master_template_id}?project_id=${project.id}`"
            class="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            + New Consolidation
          </RouterLink>
        </div>

        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div v-if="loadingReports" class="py-10 text-center text-sm text-gray-400">Loading…</div>
          <table v-else class="min-w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 bg-gray-50">
                <th class="px-5 py-3 text-left text-xs font-medium text-gray-500">Report Name</th>
                <th class="px-5 py-3 text-left text-xs font-medium text-gray-500">Period</th>
                <th class="px-5 py-3 text-left text-xs font-medium text-gray-500">Generated</th>
                <th class="px-5 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr
                v-for="r in masterReports"
                :key="r.id"
                class="hover:bg-gray-50 transition-colors"
              >
                <!-- Name (inline rename) -->
                <td class="px-5 py-3.5 font-medium text-gray-800">
                  <div v-if="renamingId === r.id" class="flex items-center gap-2">
                    <input
                      v-model="renameValue"
                      class="rounded border border-violet-400 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 w-48"
                      @keydown.enter="saveRename(r)"
                      @keydown.esc="renamingId = null"
                    />
                    <button class="text-xs text-violet-600 hover:underline" @click="saveRename(r)">Save</button>
                    <button class="text-xs text-gray-400 hover:underline" @click="renamingId = null">Cancel</button>
                  </div>
                  <span v-else>{{ r.name ?? r.id }}</span>
                </td>
                <td class="px-5 py-3.5 text-gray-500 text-xs">{{ r.period ?? '—' }}</td>
                <td class="px-5 py-3.5 text-gray-500 text-xs">{{ formatDateTime(r.generated_at) }}</td>
                <td class="px-5 py-3.5">
                  <div class="flex items-center gap-3">
                    <RouterLink
                      :to="`/admin/master-sheets/${r.id}`"
                      class="text-xs text-violet-600 hover:underline"
                    >View</RouterLink>
                    <button
                      class="text-xs text-blue-600 hover:underline"
                      @click="adminStore.downloadMasterReport(r.id)"
                    >Download</button>
                    <button
                      class="text-xs text-gray-500 hover:underline"
                      @click="startRename(r)"
                    >Rename</button>
                    <button
                      class="text-xs text-red-400 hover:text-red-600 transition-colors"
                      @click="deleteReport(r)"
                    >Delete</button>
                  </div>
                </td>
              </tr>
              <tr v-if="!masterReports.length">
                <td colspan="4" class="py-20 text-center">
                  <div class="flex flex-col items-center gap-3">
                    <svg width="120" height="90" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <ellipse cx="60" cy="75" rx="40" ry="6" fill="#EDE9FE"/>
                      <rect x="20" y="30" width="60" height="8" rx="4" fill="#C4B5FD"/>
                      <rect x="28" y="44" width="44" height="8" rx="4" fill="#DDD6FE"/>
                      <rect x="10" y="58" width="70" height="8" rx="4" fill="#EDE9FE"/>
                      <circle cx="72" cy="36" r="22" fill="#7C3AED"/>
                      <circle cx="72" cy="36" r="14" fill="white" fill-opacity="0.15"/>
                      <circle cx="72" cy="36" r="10" stroke="white" stroke-width="2.5" fill="none"/>
                      <path d="M79 43l6 6" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                      <circle cx="44" cy="22" r="4" fill="#C4B5FD"/>
                      <circle cx="100" cy="52" r="5" fill="#DDD6FE"/>
                      <circle cx="18" cy="48" r="3" fill="#EDE9FE"/>
                    </svg>
                    <p class="text-sm text-gray-400">No Data to Show</p>
                    <p v-if="!project?.master_template_id" class="text-xs text-gray-400">
                      Assign a master template above to enable consolidation.
                    </p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- ── Formulas ── -->
      <template v-else-if="activeTab === 'formulas'">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-base font-semibold text-gray-800">
            Formula Library ({{ formulasStore.formulas.length }})
          </h2>
          <button
            class="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
            @click="showFormulaForm = !showFormulaForm"
          >
            {{ showFormulaForm ? '✕ Cancel' : '+ Add Formula' }}
          </button>
        </div>

        <!-- Add formula form -->
        <div v-if="showFormulaForm" class="mb-5 bg-white rounded-xl border border-violet-200 p-5">
          <h3 class="text-sm font-semibold text-gray-700 mb-4">New Formula</h3>
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label class="block text-xs text-gray-500 mb-1">Name *</label>
              <input
                v-model="newFormula.name"
                type="text"
                placeholder="e.g. Injury Rate"
                class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Type</label>
              <select v-model="newFormula.formula_type" class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="calculation">Calculation</option>
                <option value="aggregation">Aggregation</option>
                <option value="validation">Validation</option>
              </select>
            </div>
          </div>
          <!-- Parameters -->
          <div class="mb-4">
            <label class="block text-xs text-gray-500 mb-1">Parameters</label>
            <div class="flex flex-wrap gap-1.5 mb-2">
              <span
                v-for="p in newFormulaParams"
                :key="p"
                class="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700"
              >
                {{ p }}
                <button type="button" class="ml-0.5 text-violet-400 hover:text-violet-700" @click="removeParam(p)">×</button>
              </span>
            </div>
            <div class="flex gap-2">
              <input
                v-model="newFormulaParamInput"
                type="text"
                placeholder="e.g. incidents"
                class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                @keydown.enter.prevent="addParam"
                @keydown.comma.prevent="addParam"
              />
              <button type="button" class="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50" @click="addParam">Add</button>
            </div>
            <p class="text-xs text-gray-400 mt-1">Press Enter or comma after each name. Use these names in the expression below.</p>
          </div>

          <div class="mb-4">
            <label class="block text-xs text-gray-500 mb-1">Expression *</label>
            <input
              v-model="newFormula.expression"
              type="text"
              :placeholder="newFormulaParams.length >= 2 ? `e.g. (${newFormulaParams[0]} / ${newFormulaParams[1]}) * 200000` : 'e.g. (incidents / hours_worked) * 200000'"
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <p class="text-xs text-gray-400 mt-1">
              Use your parameter names as variables.
              <span v-if="newFormulaParams.length" class="text-violet-600">
                Available: {{ newFormulaParams.join(', ') }}
              </span>
            </p>
          </div>
          <div class="mb-4">
            <label class="block text-xs text-gray-500 mb-1">Description (optional)</label>
            <input
              v-model="newFormula.description"
              type="text"
              placeholder="What does this formula calculate?"
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div v-if="formulaError" class="mb-3 text-sm text-red-600">{{ formulaError }}</div>
          <div class="flex justify-end gap-2">
            <button class="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100" @click="showFormulaForm = false">Cancel</button>
            <button
              :disabled="addingFormula"
              class="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
              @click="addFormula"
            >{{ addingFormula ? 'Saving…' : 'Save Formula' }}</button>
          </div>
        </div>

        <!-- Formula table -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div v-if="formulasStore.loading" class="py-10 text-center text-sm text-gray-400">Loading…</div>
          <table v-else class="min-w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 bg-gray-50">
                <th class="px-5 py-3 text-left text-xs font-medium text-gray-500">Name</th>
                <th class="px-5 py-3 text-left text-xs font-medium text-gray-500">Parameters</th>
                <th class="px-5 py-3 text-left text-xs font-medium text-gray-500">Expression</th>
                <th class="px-5 py-3 text-left text-xs font-medium text-gray-500">Type</th>
                <th class="px-5 py-3 text-left text-xs font-medium text-gray-500">Description</th>
                <th class="px-5 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr
                v-for="f in formulasStore.formulas"
                :key="f.id"
                class="hover:bg-gray-50 transition-colors"
              >
                <td class="px-5 py-3.5 font-medium text-gray-800">{{ f.name }}</td>
                <td class="px-5 py-3.5">
                  <div v-if="f.parameters?.length" class="flex flex-wrap gap-1">
                    <span
                      v-for="p in f.parameters"
                      :key="p"
                      class="inline-flex px-2 py-0.5 rounded-full text-xs bg-violet-100 text-violet-700 font-mono"
                    >{{ p }}</span>
                  </div>
                  <span v-else class="text-gray-400 text-xs">—</span>
                </td>
                <td class="px-5 py-3.5 font-mono text-xs text-blue-700 max-w-xs">
                  <span class="block truncate" :title="f.expression">{{ f.expression }}</span>
                </td>
                <td class="px-5 py-3.5">
                  <span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                    {{ f.formula_type }}
                  </span>
                </td>
                <td class="px-5 py-3.5 text-gray-500 text-xs max-w-xs">
                  <span class="block truncate">{{ f.description ?? '—' }}</span>
                </td>
                <td class="px-5 py-3.5">
                  <button
                    class="text-xs text-red-400 hover:text-red-600 transition-colors"
                    @click="formulasStore.deleteFormula(f.id)"
                  >Delete</button>
                </td>
              </tr>
              <tr v-if="!formulasStore.formulas.length">
                <td colspan="5" class="py-20 text-center">
                  <div class="flex flex-col items-center gap-3">
                    <svg width="120" height="90" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <ellipse cx="60" cy="75" rx="40" ry="6" fill="#EDE9FE"/>
                      <rect x="20" y="30" width="60" height="8" rx="4" fill="#C4B5FD"/>
                      <rect x="28" y="44" width="44" height="8" rx="4" fill="#DDD6FE"/>
                      <rect x="10" y="58" width="70" height="8" rx="4" fill="#EDE9FE"/>
                      <circle cx="72" cy="36" r="22" fill="#7C3AED"/>
                      <circle cx="72" cy="36" r="14" fill="white" fill-opacity="0.15"/>
                      <circle cx="72" cy="36" r="10" stroke="white" stroke-width="2.5" fill="none"/>
                      <path d="M79 43l6 6" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                      <circle cx="44" cy="22" r="4" fill="#C4B5FD"/>
                      <circle cx="100" cy="52" r="5" fill="#DDD6FE"/>
                      <circle cx="18" cy="48" r="3" fill="#EDE9FE"/>
                    </svg>
                    <p class="text-sm text-gray-400">No formulas yet.</p>
                    <p class="text-xs text-gray-400">Add formulas to define KPI calculations for this project.</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- ── Notifications (TODO) ── -->
      <template v-else-if="activeTab === 'notifications'">
        <div class="flex flex-col items-center justify-center py-24 text-center">
          <div class="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
            </svg>
          </div>
          <p class="text-sm font-medium text-gray-600">Notifications</p>
          <p class="text-xs text-gray-400 mt-1">TODO — coming soon</p>
        </div>
      </template>

    </div>
  </div>

  <!-- Add Member Modal -->
  <Teleport to="body">
    <div v-if="showMemberModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 class="font-semibold text-gray-800">Add Sub-Contractor</h2>
          <button class="text-gray-400 hover:text-gray-600 text-lg" @click="showMemberModal = false">✕</button>
        </div>
        <div class="p-5 space-y-3">
          <div>
            <label class="block text-xs text-gray-500 mb-1">User *</label>
            <select v-model="memberUserId" class="block w-full rounded border border-gray-300 px-3 py-2 text-sm">
              <option :value="null">Select…</option>
              <option v-for="u in availableUsers()" :key="u.id" :value="u.id">
                {{ u.display_name }} ({{ u.email }})
              </option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Project Role *</label>
            <select v-model="memberParticipantRole" class="block w-full rounded border border-gray-300 px-3 py-2 text-sm">
              <option value="focal">Focal (can submit)</option>
              <option value="member">Member (view only)</option>
              <option value="viewer">Viewer (view only)</option>
            </select>
          </div>
          <div v-if="memberError" class="text-sm text-red-600">{{ memberError }}</div>
        </div>
        <div class="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button class="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100" @click="showMemberModal = false">Cancel</button>
          <button
            :disabled="addingMember"
            class="px-4 py-2 rounded bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
            @click="addMember"
          >{{ addingMember ? 'Adding…' : 'Add' }}</button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Assign Template Modal -->
  <Teleport to="body">
    <div v-if="showTemplateModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 class="font-semibold text-gray-800">Assign Template</h2>
          <button class="text-gray-400 hover:text-gray-600 text-lg" @click="showTemplateModal = false">✕</button>
        </div>
        <div class="p-5 space-y-4">
          <div>
            <label class="block text-xs text-gray-500 mb-1">Template *</label>
            <select v-model="selectedTemplateId" class="block w-full rounded border border-gray-300 px-3 py-2 text-sm" @change="onTemplateChange">
              <option value="">Select template…</option>
              <option v-for="t in templatesStore.templates" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </div>
          <div v-if="selectedTemplateId">
            <label class="block text-xs text-gray-500 mb-1">Version *</label>
            <select v-model="selectedVersionId" class="block w-full rounded border border-gray-300 px-3 py-2 text-sm">
              <option value="">Select version…</option>
              <option v-for="v in versionsForTemplate()" :key="v.id" :value="v.id">v{{ v.version_number }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Deadline (optional)</label>
            <input v-model="templateDeadline" type="date" class="block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div v-if="project?.members?.length">
            <label class="block text-xs text-gray-500 mb-2">Assign to</label>
            <div class="border border-gray-200 rounded-lg divide-y text-sm">
              <label class="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" :checked="selectedMemberIds.length === 0" class="rounded" @change="selectedMemberIds = []" />
                <span class="font-medium text-gray-700">All members</span>
              </label>
              <label v-for="m in project.members" :key="m.user_id" class="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50">
                <input v-model="selectedMemberIds" type="checkbox" :value="m.user_id" class="rounded" />
                <span class="text-gray-700">{{ m.display_name }}</span>
                <span class="text-gray-400 text-xs ml-auto">{{ m.email }}</span>
              </label>
            </div>
            <p class="text-xs text-gray-400 mt-1">
              {{ selectedMemberIds.length === 0 ? 'All members will see this template.' : `${selectedMemberIds.length} member(s) selected.` }}
            </p>
          </div>
          <div v-if="templateError" class="text-sm text-red-600">{{ templateError }}</div>
        </div>
        <div class="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button class="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100" @click="showTemplateModal = false">Cancel</button>
          <button
            :disabled="assigningTemplate"
            class="px-4 py-2 rounded bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
            @click="assignTemplate"
          >{{ assigningTemplate ? 'Assigning…' : 'Assign' }}</button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Assign Master Template Modal -->
  <Teleport to="body">
    <div v-if="showMasterModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 class="font-semibold text-gray-800">Assign Master Template</h2>
          <button class="text-gray-400 hover:text-gray-600 text-lg" @click="showMasterModal = false">✕</button>
        </div>
        <div class="p-5 space-y-4">
          <div>
            <label class="block text-xs text-gray-500 mb-1">Master Template *</label>
            <select v-model="selectedMasterTemplateId" class="block w-full rounded border border-gray-300 px-3 py-2 text-sm">
              <option value="">Select master template…</option>
              <option v-for="t in masterTemplates" :key="t.id" :value="t.id">
                {{ t.name }}<template v-if="t.status !== 'active'"> ({{ t.status }})</template>
              </option>
            </select>
            <p v-if="!masterTemplates.length" class="mt-1 text-xs text-gray-400">
              No master templates exist yet.
              <RouterLink to="/admin/master-template" class="text-violet-600 hover:underline">Create one →</RouterLink>
            </p>
          </div>
          <div v-if="masterError" class="text-sm text-red-600">{{ masterError }}</div>
        </div>
        <div class="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button class="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100" @click="showMasterModal = false">Cancel</button>
          <button
            :disabled="settingMaster || !selectedMasterTemplateId"
            class="px-4 py-2 rounded bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
            @click="setMasterTemplate(selectedMasterTemplateId)"
          >{{ settingMaster ? 'Saving…' : 'Assign' }}</button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Upload KPI Template modal -->
  <Teleport to="body">
    <div
      v-if="showUploadModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      @click.self="showUploadModal = false"
    >
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
        <h3 class="font-semibold text-gray-800">Upload KPI Template</h3>
        <p class="text-xs text-gray-500">
          Upload an xlsx file — it will be saved as a new template that you can assign to DevCos.
        </p>

        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Template Name</label>
          <input
            v-model="uploadTemplateName"
            type="text"
            placeholder="e.g. Safety KPI Template"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Excel File (.xlsx)</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            class="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-violet-700 hover:file:bg-violet-100"
            @change="handleTemplateFileChange"
          />
        </div>

        <p v-if="uploadTemplateError" class="text-xs text-red-600">{{ uploadTemplateError }}</p>
        <p v-if="uploadTemplateSuccess" class="text-xs text-green-600">{{ uploadTemplateSuccess }}</p>

        <div class="flex justify-end gap-3 pt-1">
          <button
            class="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
            @click="showUploadModal = false"
          >Cancel</button>
          <button
            :disabled="uploadingTemplate"
            class="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
            @click="uploadXlsxTemplate"
          >
            {{ uploadingTemplate ? 'Uploading…' : 'Upload Template' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
