<script setup lang="ts">
import { watch } from 'vue'

interface OrgStatus {
  org_id: string
  org_name: string
  assignment_id: string | null
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

const props = defineProps<{
  progress: Progress
  selectable?: boolean
  selected?: string[]
}>()

const emit = defineEmits<{
  'all-submitted': []
  'update:selected': [ids: string[]]
}>()

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

function isChecked(submissionId: string) {
  return props.selected?.includes(submissionId) ?? false
}

function toggleOne(submissionId: string) {
  const current = props.selected ?? []
  const next = current.includes(submissionId)
    ? current.filter(id => id !== submissionId)
    : [...current, submissionId]
  emit('update:selected', next)
}

function allSelectableIds() {
  return props.progress.orgs
    .filter(o => o.submission_id)
    .map(o => o.submission_id as string)
}

function allChecked() {
  const ids = allSelectableIds()
  return ids.length > 0 && ids.every(id => props.selected?.includes(id))
}

function toggleAll() {
  const ids = allSelectableIds()
  emit('update:selected', allChecked() ? [] : ids)
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
            <th v-if="selectable" class="px-4 py-2.5 w-10">
              <input
                type="checkbox"
                class="rounded"
                :checked="allChecked()"
                :disabled="allSelectableIds().length === 0"
                @change="toggleAll"
              />
            </th>
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
            :class="selectable && org.submission_id ? 'cursor-pointer' : ''"
            @click="selectable && org.submission_id ? toggleOne(org.submission_id) : undefined"
          >
            <td v-if="selectable" class="px-4 py-3 w-10" @click.stop>
              <input
                v-if="org.submission_id"
                type="checkbox"
                class="rounded"
                :checked="isChecked(org.submission_id)"
                @change="toggleOne(org.submission_id!)"
              />
            </td>
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
            <td :colspan="selectable ? 5 : 4" class="px-4 py-6 text-center text-xs text-muted">
              No subcontractors assigned to this template yet.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Selection hint -->
    <p v-if="selectable && progress.orgs.length" class="text-xs text-gray-400">
      {{ (selected?.length ?? 0) === 0
        ? 'Select subcontractors to include in consolidation, or leave all unchecked to consolidate everyone.'
        : `${selected!.length} subcontractor(s) selected.` }}
    </p>
  </div>
</template>
