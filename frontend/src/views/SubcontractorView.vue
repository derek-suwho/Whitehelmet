<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api, ApiError } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import TopBar from '@/components/layout/TopBar.vue'

interface Assignment {
  id: string
  template_version_id: string | null
  deadline: string | null
  instructions: string | null
  status: 'pending' | 'submitted' | 'locked'
  assigned_at: string
  template_name: string | null
  has_submission: boolean
  participant_role: 'focal' | 'member' | 'viewer' | null
}

interface SubmissionRecord {
  id: string
  assignment_id: string
  org_id: string
  file_name: string
  status: string
  submitted_at: string
  submitted_by: string | null
  review_status: string | null
  review_comment: string | null
}

const auth = useAuthStore()
const router = useRouter()
const assignments = ref<Assignment[]>([])
const submissions = ref<SubmissionRecord[]>([])
const loading = ref(true)
const uploading = ref<string | null>(null)
const uploadErrors = ref<Record<string, string>>({})

async function fetchData() {
  loading.value = true
  try {
    const [a, s] = await Promise.all([
      api.get<Assignment[]>('/api/subcontractor/assignments'),
      api.get<SubmissionRecord[]>('/api/subcontractor/submissions'),
    ])
    assignments.value = a
    submissions.value = s
  } finally {
    loading.value = false
  }
}

async function downloadTemplate(assignmentId: string) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = session ? { Authorization: `Bearer ${session.access_token}` } : {}
  const res = await fetch(`/api/subcontractor/assignments/${assignmentId}/template-download`, { headers })
  if (!res.ok) { alert('Download failed: ' + res.statusText); return }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const cd = res.headers.get('content-disposition') ?? ''
  a.download = cd.match(/filename="?([^"]+)"?/)?.[1] ?? 'template.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

async function handleFileUpload(assignmentId: string, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploading.value = assignmentId
  uploadErrors.value = { ...uploadErrors.value, [assignmentId]: '' }

  try {
    await api.upload<SubmissionRecord>(
      `/api/subcontractor/assignments/${assignmentId}/submit`,
      file,
    )
    await fetchData()
  } catch (e) {
    const msg = e instanceof ApiError ? e.body : e instanceof Error ? e.message : 'Upload failed'
    uploadErrors.value = { ...uploadErrors.value, [assignmentId]: msg }
  } finally {
    uploading.value = null
    input.value = ''
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

const pendingCount = computed(() => assignments.value.filter(a => a.status === 'pending').length)

const viewingComment = ref<string | null>(null)

onMounted(fetchData)
</script>

<template>
  <div class="min-h-screen bg-surface-light pt-14">
    <TopBar />
    <div class="mx-auto max-w-4xl px-6 py-8 space-y-8">

      <!-- Page header -->
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">My Assignments</h1>
        <p class="mt-1 text-sm text-muted">
          {{ auth.user?.display_name ?? auth.user?.email }}
          <span v-if="pendingCount > 0"> · {{ pendingCount }} pending</span>
        </p>
      </div>

      <!-- Loading skeleton -->
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="h-24 bg-white rounded-xl border border-border animate-pulse" />
      </div>

      <!-- Assignment cards -->
      <div v-else-if="assignments.length" class="space-y-4">
        <div
          v-for="a in assignments"
          :key="a.id"
          class="bg-surface-card rounded-xl border border-border p-5 space-y-3 shadow-sm"
        >
          <!-- Card header -->
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="font-semibold text-gray-800">
                {{ a.template_name ?? 'Untitled Template' }}
              </h2>
              <p class="text-xs text-muted mt-0.5">
                Assigned {{ formatDate(a.assigned_at) }}
                <span v-if="a.deadline"> · Due {{ formatDate(a.deadline) }}</span>
              </p>
            </div>

            <!-- Status badge -->
            <span
              class="shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
              :class="{
                'bg-amber-100 text-amber-700': a.status === 'pending',
                'bg-green-100 text-green-700': a.status === 'submitted',
                'bg-gray-100 text-gray-500':   a.status === 'locked',
              }"
            >
              {{ a.status }}
            </span>
          </div>

          <!-- Instructions -->
          <p
            v-if="a.instructions"
            class="text-sm text-gray-600 bg-gray-50 border border-border rounded-lg px-3 py-2"
          >
            {{ a.instructions }}
          </p>

          <!-- Actions -->
          <div class="flex flex-wrap items-center gap-3 pt-1">
            <!-- Fill Online -->
            <button
              v-if="a.status !== 'locked' && a.participant_role === 'focal'"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg border border-brand-500 text-brand-600 px-4 py-1.5 text-sm font-medium hover:bg-brand-50 transition-colors"
              @click="router.push({ name: 'assignment-fill', params: { assignmentId: a.id }, query: { name: a.template_name ?? 'Template' } })"
            >
              Fill Online
            </button>

            <!-- Download template -->
            <button
              type="button"
              class="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
              @click="downloadTemplate(a.id)"
            >
              Download template
            </button>

            <!-- Upload / locked — only focal participants can submit -->
            <template v-if="a.status !== 'locked' && a.participant_role === 'focal'">
              <label
                :for="`upload-${a.id}`"
                class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
                :class="{ 'pointer-events-none opacity-60': uploading === a.id }"
              >
                <svg v-if="uploading === a.id" class="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                {{ uploading === a.id ? 'Uploading…' : a.has_submission ? 'Replace submission' : 'Upload submission' }}
              </label>
              <input
                :id="`upload-${a.id}`"
                type="file"
                accept=".xlsx,.xls"
                class="sr-only"
                :disabled="uploading === a.id"
                @change="handleFileUpload(a.id, $event)"
              />
            </template>
            <span v-else-if="a.status === 'locked'" class="text-xs text-muted italic">Locked — no further submissions</span>
            <span v-else-if="a.participant_role !== 'focal'" class="text-xs text-muted italic">View only</span>

            <!-- Upload error -->
            <span v-if="uploadErrors[a.id]" class="text-xs text-red-600">
              {{ uploadErrors[a.id] }}
            </span>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="flex flex-col items-center justify-center py-20 text-center">
        <svg class="mb-4 h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <p class="text-sm font-medium text-gray-500">No assignments yet</p>
        <p class="mt-1 text-xs text-muted">Your project manager will assign templates here.</p>
      </div>

      <!-- Submission history -->
      <section v-if="submissions.length">
        <h2 class="text-lg font-semibold text-gray-900 mb-3">Submission History</h2>
        <div class="overflow-hidden rounded-xl border border-border bg-surface-card shadow-sm">
          <table class="min-w-full divide-y divide-border text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">File</th>
                <th class="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">Submitted</th>
                <th class="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">Status</th>
                <th class="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">Verification</th>
                <th class="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">Comments</th>
                <th class="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr v-for="s in submissions" :key="s.id" class="hover:bg-gray-50 transition-colors">
                <td class="px-5 py-3 font-medium text-gray-800">{{ s.file_name }}</td>
                <td class="px-5 py-3 text-muted">{{ formatDateTime(s.submitted_at) }}</td>
                <td class="px-5 py-3">
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    :class="{
                      'bg-green-100 text-green-700': s.status === 'submitted',
                      'bg-blue-100 text-blue-700':   s.status === 'resubmitted',
                      'bg-gray-100 text-gray-500':   s.status === 'locked',
                    }"
                  >
                    {{ s.status }}
                  </span>
                </td>
                <td class="px-5 py-3">
                  <span
                    v-if="s.review_status === 'approved'"
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"
                  >✓ Approved</span>
                  <span
                    v-else-if="s.review_status === 'changes_requested'"
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"
                  >↩ Changes Requested</span>
                  <span
                    v-else
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500"
                  >Awaiting Verification</span>
                </td>
                <td class="px-5 py-3">
                  <button
                    v-if="s.review_comment"
                    class="text-xs text-violet-600 hover:underline font-medium"
                    @click="viewingComment = s.review_comment"
                  >View</button>
                  <span v-else class="text-xs text-gray-400">—</span>
                </td>
                <td class="px-5 py-3">
                  <template v-if="s.review_status === 'changes_requested' && assignments.find(a => a.id === s.assignment_id)?.participant_role === 'focal'">
                    <label
                      :for="`resubmit-${s.id}`"
                      class="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-amber-500 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-600"
                      :class="{ 'pointer-events-none opacity-60': uploading === s.assignment_id }"
                    >
                      <svg v-if="uploading === s.assignment_id" class="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                      {{ uploading === s.assignment_id ? 'Uploading…' : 'Resubmit' }}
                    </label>
                    <input
                      :id="`resubmit-${s.id}`"
                      type="file"
                      accept=".xlsx,.xls"
                      class="sr-only"
                      :disabled="uploading === s.assignment_id"
                      @change="handleFileUpload(s.assignment_id, $event)"
                    />
                    <p v-if="uploadErrors[s.assignment_id]" class="mt-1 text-xs text-red-600">
                      {{ uploadErrors[s.assignment_id] }}
                    </p>
                  </template>
                  <span v-else class="text-xs text-gray-400">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Comment modal -->
      <Teleport to="body">
        <div
          v-if="viewingComment"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          @click.self="viewingComment = null"
        >
          <div class="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 class="font-semibold text-gray-800 mb-3">PIF Comment</h3>
            <p class="text-sm text-gray-600 whitespace-pre-wrap">{{ viewingComment }}</p>
            <button
              class="mt-4 w-full rounded-lg bg-gray-100 py-2 text-sm text-gray-600 hover:bg-gray-200"
              @click="viewingComment = null"
            >Close</button>
          </div>
        </div>
      </Teleport>

    </div>
  </div>
</template>
