<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useRecordsStore } from '@/stores/records'
import { useSpreadsheetStore } from '@/stores/spreadsheet'
import * as XLSX from 'xlsx'
import type { MasterRecord } from '@/types'

const router = useRouter()
const records = useRecordsStore()
const spreadsheet = useSpreadsheetStore()

const deletingId = ref<number | null>(null)
const openingId = ref<number | null>(null)
const searchQuery = ref('')
const sortKey = ref<'name' | 'date'>('date')
const sortDir = ref<'asc' | 'desc'>('desc')

onMounted(() => {
  records.fetchRecords()
})

const filtered = computed(() => {
  let list = records.records.slice()
  const q = searchQuery.value.trim().toLowerCase()
  if (q) list = list.filter((r) => r.name.toLowerCase().includes(q))
  list.sort((a, b) => {
    let cmp = 0
    if (sortKey.value === 'name') {
      cmp = a.name.localeCompare(b.name)
    } else {
      cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    }
    return sortDir.value === 'asc' ? cmp : -cmp
  })
  return list
})

function toggleSort(key: 'name' | 'date') {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = key === 'date' ? 'desc' : 'asc'
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function goBack() {
  router.push({ name: 'workspace' })
}

async function handleOpen(record: MasterRecord) {
  openingId.value = record.id
  try {
    const full = await records.fetchRecord(record.id)
    const wsData = [full.headers, ...(full.rows as unknown[][])]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, record.name)
    spreadsheet.loadWorkbook(wb, `${record.name}.xlsx`)
    router.push({ name: 'workspace' })
  } catch (err) {
    console.error('[dashboard] open record failed:', err)
  } finally {
    openingId.value = null
  }
}

async function handleDelete(record: MasterRecord) {
  deletingId.value = record.id
  try {
    await records.deleteRecord(record.id)
  } finally {
    deletingId.value = null
  }
}

function sortIcon(key: 'name' | 'date') {
  if (sortKey.value !== key) return '↕'
  return sortDir.value === 'asc' ? '↑' : '↓'
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
        class="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-400 transition-colors duration-200 hover:bg-white/5 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        @click="goBack"
      >
        Back to Workspace
      </button>
    </div>

    <!-- Search + count bar -->
    <div class="flex items-center gap-3 border-b border-white/5 px-6 py-3">
      <div class="relative flex-1 max-w-xs">
        <svg class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Search records…"
          class="w-full rounded-md border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-sm text-gray-300 placeholder-gray-600 focus:border-brand-500/40 focus:outline-none"
        />
      </div>
      <span class="text-xs text-gray-600">{{ filtered.length }} record{{ filtered.length !== 1 ? 's' : '' }}</span>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto">
      <!-- Loading -->
      <div v-if="records.loading" class="flex items-center justify-center py-20">
        <svg class="h-8 w-8 animate-spin text-brand-400" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
        </svg>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="records.records.length === 0"
        class="flex flex-col items-center justify-center py-20 text-center"
      >
        <svg class="mb-4 h-16 w-16 text-gray-700/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/>
        </svg>
        <h3 class="font-display text-lg text-gray-400">No records yet</h3>
        <p class="mt-2 max-w-xs text-sm leading-relaxed text-gray-600">
          Consolidate files from the workspace to create your first master record.
        </p>
      </div>

      <!-- No search results -->
      <div
        v-else-if="filtered.length === 0"
        class="flex flex-col items-center justify-center py-20 text-center"
      >
        <p class="text-sm text-gray-500">No records match "<span class="text-gray-300">{{ searchQuery }}</span>"</p>
      </div>

      <!-- Table -->
      <table v-else class="w-full text-sm">
        <thead class="border-b border-white/5 bg-surface">
          <tr>
            <th class="px-6 py-2.5 text-left">
              <button
                type="button"
                class="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors"
                @click="toggleSort('name')"
              >
                Name <span class="tabular-nums">{{ sortIcon('name') }}</span>
              </button>
            </th>
            <th class="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Sources</th>
            <th class="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Rows</th>
            <th class="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Cols</th>
            <th class="px-6 py-2.5 text-left">
              <button
                type="button"
                class="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors"
                @click="toggleSort('date')"
              >
                Date <span class="tabular-nums">{{ sortIcon('date') }}</span>
              </button>
            </th>
            <th class="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5">
          <tr
            v-for="record in filtered"
            :key="record.id"
            class="group transition-colors hover:bg-white/[0.02]"
          >
            <td class="px-6 py-3 font-medium text-gray-200 max-w-xs truncate">
              {{ record.name }}
            </td>
            <td class="px-4 py-3 text-right tabular-nums text-gray-500">{{ record.source_count }}</td>
            <td class="px-4 py-3 text-right tabular-nums text-gray-500">{{ record.row_count }}</td>
            <td class="px-4 py-3 text-right tabular-nums text-gray-500">{{ record.col_count }}</td>
            <td class="px-6 py-3 text-gray-500">{{ formatDate(record.created_at) }}</td>
            <td class="px-4 py-3">
              <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <!-- Open -->
                <button
                  type="button"
                  :disabled="openingId === record.id"
                  class="rounded px-2.5 py-1 text-xs text-gray-400 hover:bg-white/5 hover:text-brand-400 transition-colors disabled:opacity-50"
                  :aria-label="`Open ${record.name}`"
                  @click="handleOpen(record)"
                >
                  <svg v-if="openingId === record.id" class="inline-block h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                  </svg>
                  <span v-else>Open</span>
                </button>
                <!-- Delete -->
                <button
                  type="button"
                  :disabled="deletingId === record.id"
                  class="rounded p-1.5 text-gray-600 hover:bg-white/5 hover:text-red-400 transition-colors disabled:opacity-50"
                  :aria-label="`Delete ${record.name}`"
                  @click="handleDelete(record)"
                >
                  <svg v-if="deletingId === record.id" class="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                  </svg>
                  <svg v-else class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd"/>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
