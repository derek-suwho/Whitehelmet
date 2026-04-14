<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRecordsStore } from '@/stores/records'
import type { MasterRecord } from '@/types'

const router = useRouter()
const records = useRecordsStore()
const deletingId = ref<number | null>(null)

onMounted(() => {
  records.fetchRecords()
})

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function goBack() {
  router.push({ name: 'workspace' })
}

async function handleDelete(record: MasterRecord) {
  deletingId.value = record.id
  try {
    await records.deleteRecord(record.id)
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div class="flex flex-1 flex-col overflow-hidden bg-surface pt-14">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-white/5 px-6 py-4">
      <div>
        <h1 class="font-display text-xl tracking-tight text-gray-200">Master Records</h1>
        <p class="mt-0.5 text-sm text-gray-500">Saved consolidation results</p>
      </div>
      <button
        type="button"
        class="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-400 transition-colors duration-200 hover:bg-white/5 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:bg-white/10"
        @click="goBack"
      >
        Back to Workspace
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6">
      <!-- Loading -->
      <div
        v-if="records.loading"
        class="flex items-center justify-center py-20"
      >
        <svg
          class="h-8 w-8 animate-spin text-brand-400"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="records.records.length === 0"
        class="flex flex-col items-center justify-center py-20 text-center"
      >
        <svg
          class="mb-4 h-16 w-16 text-gray-700/50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1"
            d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
          />
        </svg>
        <h3 class="font-display text-lg text-gray-400">No records yet</h3>
        <p class="mt-2 max-w-xs text-sm leading-relaxed text-gray-600">
          Consolidate files from the workspace to create your first master record.
        </p>
      </div>

      <!-- Grid -->
      <div
        v-else
        class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <article
          v-for="record in records.records"
          :key="record.id"
          class="group relative rounded-xl border border-white/5 bg-surface-light p-5 transition-all duration-200 hover:border-brand-500/20 hover:shadow-lg hover:shadow-brand-500/5"
        >
          <!-- Name -->
          <h3 class="mb-1 truncate font-display text-base font-semibold text-gray-200">
            {{ record.name }}
          </h3>

          <!-- Date -->
          <p class="mb-4 text-xs text-gray-500">
            {{ formatDate(record.created_at) }}
          </p>

          <!-- Stats -->
          <div class="flex gap-4 text-xs text-gray-500">
            <div class="flex items-center gap-1">
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12" />
              </svg>
              <span>{{ record.source_count }} sources</span>
            </div>
            <div class="flex items-center gap-1">
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" />
              </svg>
              <span>{{ record.row_count }} rows</span>
            </div>
            <div class="flex items-center gap-1">
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z" />
              </svg>
              <span>{{ record.col_count }} cols</span>
            </div>
          </div>

          <!-- Delete button -->
          <button
            type="button"
            :disabled="deletingId === record.id"
            class="absolute right-3 top-3 rounded-md p-1.5 text-gray-600 opacity-0 transition-all duration-200 group-hover:opacity-100 hover:bg-white/5 hover:text-red-400 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 active:text-red-300"
            :aria-label="`Delete ${record.name}`"
            @click="handleDelete(record)"
          >
            <svg
              v-if="deletingId === record.id"
              class="h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <svg
              v-else
              class="h-4 w-4"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </article>
      </div>
    </div>
  </div>
</template>
