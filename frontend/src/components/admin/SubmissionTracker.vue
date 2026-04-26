<script setup lang="ts">
import { watch } from 'vue'

interface OrgStatus {
  org_id: string
  org_name: string
  assignment_id: string
  assignment_status: string
  submission_id: string | null
  submitted_at: string | null
  file_name: string | null
}

interface Progress {
  template_id: string
  template_version_id: string | null
  total_orgs: number
  submitted_count: number
  all_submitted: boolean
  orgs: OrgStatus[]
}

const props = defineProps<{ progress: Progress }>()
const emit = defineEmits<{ 'all-submitted': [] }>()

watch(
  () => props.progress.all_submitted,
  (v) => { if (v) emit('all-submitted') },
  { immediate: true },
)

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function pct() {
  if (!props.progress.total_orgs) return 0
  return Math.round((props.progress.submitted_count / props.progress.total_orgs) * 100)
}
</script>

<template>
  <div class="rounded-xl border border-border bg-surface-card p-5 shadow-sm space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold text-gray-800">Submission Progress</h2>
      <span
        class="text-sm font-medium"
        :class="progress.all_submitted ? 'text-green-600' : 'text-muted'"
      >
        {{ progress.submitted_count }} / {{ progress.total_orgs }} submitted
      </span>
    </div>

    <!-- Progress bar -->
    <div class="h-2 overflow-hidden rounded-full bg-gray-100">
      <div
        class="h-full rounded-full bg-green-500 transition-all duration-500"
        :style="{ width: `${pct()}%` }"
      />
    </div>

    <!-- Per-org table -->
    <div class="overflow-hidden rounded-lg border border-border">
      <table class="min-w-full divide-y divide-border text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Organization</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-muted uppercase tracking-wide">File</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Submitted</th>
            <th class="px-4 py-2.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr
            v-for="org in progress.orgs"
            :key="org.org_id"
            class="transition-colors hover:bg-gray-50"
          >
            <td class="px-4 py-3 font-medium text-gray-800">{{ org.org_name }}</td>
            <td class="px-4 py-3 text-muted">{{ org.file_name ?? '—' }}</td>
            <td class="px-4 py-3 text-xs text-muted">{{ formatDate(org.submitted_at) }}</td>
            <td class="px-4 py-3">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                :class="{
                  'bg-amber-100 text-amber-700': org.assignment_status === 'pending',
                  'bg-green-100 text-green-700': org.assignment_status === 'submitted',
                  'bg-gray-100 text-gray-500':   org.assignment_status === 'locked',
                }"
              >
                {{ org.assignment_status }}
              </span>
            </td>
          </tr>
          <tr v-if="!progress.orgs.length">
            <td colspan="4" class="px-4 py-6 text-center text-xs text-muted">
              No subcontractors assigned to this template yet.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
