<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useRecordsStore } from '@/stores/records'
import { useFilesStore } from '@/stores/files'
import { useSpreadsheetStore } from '@/stores/spreadsheet'
import * as XLSX from 'xlsx'
import type { MasterRecord, UserFile } from '@/types'

const router = useRouter()
const auth = useAuthStore()
const records = useRecordsStore()
const filesStore = useFilesStore()
const spreadsheet = useSpreadsheetStore()

const activeTab = ref<'files' | 'records'>('files')
const deletingFileId = ref<number | null>(null)
const deletingRecordId = ref<number | null>(null)
const openingRecordId = ref<number | null>(null)
const uploading = ref(false)
const uploadError = ref('')
const searchQuery = ref('')

onMounted(() => {
  filesStore.fetchFiles()
  records.fetchRecords()
})

const filteredFiles = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return filesStore.files
  return filesStore.files.filter((f) => f.original_name.toLowerCase().includes(q))
})

const filteredRecords = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return records.records
  return records.records.filter((r) => r.name.toLowerCase().includes(q))
})

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function handleUpload(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return

  uploading.value = true
  uploadError.value = ''
  try {
    for (const file of Array.from(input.files)) {
      await filesStore.uploadFile(file)
    }
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : 'Upload failed'
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function handleDownloadFile(file: UserFile) {
  // Download and open in workspace
  try {
    const resp = await fetch(`/api/files/${file.id}/download`, {
      credentials: 'include',
    })
    if (!resp.ok) throw new Error('Download failed')
    const blob = await resp.blob()
    const arrayBuffer = await blob.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
    spreadsheet.loadWorkbook(wb, file.original_name)
    router.push({ name: 'workspace' })
  } catch (err) {
    console.error('[dashboard] open file failed:', err)
  }
}

async function handleDeleteFile(file: UserFile) {
  deletingFileId.value = file.id
  try {
    await filesStore.deleteFile(file.id)
  } finally {
    deletingFileId.value = null
  }
}

async function handleOpenRecord(record: MasterRecord) {
  openingRecordId.value = record.id
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
    openingRecordId.value = null
  }
}

async function handleDeleteRecord(record: MasterRecord) {
  deletingRecordId.value = record.id
  try {
    await records.deleteRecord(record.id)
  } finally {
    deletingRecordId.value = null
  }
}

async function handleLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-surface">
    <!-- Top bar -->
    <header class="flex h-14 items-center justify-between border-b border-white/5 px-6">
      <h1 class="font-display text-xl tracking-tight text-brand-400">Whitehelmet</h1>
      <div class="flex items-center gap-3">
        <router-link
          :to="{ name: 'workspace' }"
          class="rounded-md border border-brand-600/40 bg-brand-600/10 px-3 py-1.5 text-sm font-medium text-brand-300 transition-colors duration-200 hover:bg-brand-600/20 hover:text-brand-200"
        >
          Workspace
        </router-link>
        <span v-if="auth.user" class="hidden text-sm text-gray-400 sm:inline">
          {{ auth.user.display_name }}
        </span>
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-sm text-gray-400 transition-colors duration-200 hover:bg-white/5 hover:text-gray-200"
          @click="handleLogout"
        >
          Logout
        </button>
      </div>
    </header>

    <!-- Content -->
    <div class="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
      <!-- Welcome -->
      <div class="mb-8">
        <h2 class="font-display text-2xl tracking-tight text-gray-200">
          Welcome back{{ auth.user ? `, ${auth.user.display_name}` : '' }}
        </h2>
        <p class="mt-1 text-sm text-gray-500">Manage your Excel files and consolidation records.</p>
      </div>

      <!-- Search + Upload bar -->
      <div class="mb-6 flex items-center gap-3">
        <div class="relative flex-1 max-w-xs">
          <svg
            class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Search..."
            class="w-full rounded-md border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-sm text-gray-300 placeholder-gray-600 focus:border-brand-500/40 focus:outline-none"
          />
        </div>

        <label
          class="cursor-pointer rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-surface shadow-lg shadow-brand-500/20 transition-colors hover:bg-brand-400"
          :class="uploading ? 'cursor-not-allowed opacity-50' : ''"
        >
          <template v-if="uploading">
            <svg
              class="mr-1 inline-block h-3.5 w-3.5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Uploading...
          </template>
          <template v-else>Upload Files</template>
          <input
            type="file"
            accept=".xlsx,.xls"
            multiple
            class="hidden"
            :disabled="uploading"
            @change="handleUpload"
          />
        </label>
      </div>

      <!-- Upload error -->
      <div
        v-if="uploadError"
        class="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300"
        role="alert"
      >
        {{ uploadError }}
      </div>

      <!-- Tabs -->
      <div class="mb-6 flex gap-1 rounded-lg bg-white/5 p-1">
        <button
          type="button"
          class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors"
          :class="
            activeTab === 'files'
              ? 'bg-brand-500/20 text-brand-300'
              : 'text-gray-500 hover:text-gray-300'
          "
          @click="activeTab = 'files'"
        >
          My Files
          <span class="ml-1 text-xs tabular-nums opacity-60">{{ filesStore.files.length }}</span>
        </button>
        <button
          type="button"
          class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors"
          :class="
            activeTab === 'records'
              ? 'bg-brand-500/20 text-brand-300'
              : 'text-gray-500 hover:text-gray-300'
          "
          @click="activeTab = 'records'"
        >
          Records
          <span class="ml-1 text-xs tabular-nums opacity-60">{{ records.records.length }}</span>
        </button>
      </div>

      <!-- FILES TAB -->
      <div v-if="activeTab === 'files'">
        <!-- Loading -->
        <div v-if="filesStore.loading" class="flex items-center justify-center py-20">
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

        <!-- Empty -->
        <div
          v-else-if="filesStore.files.length === 0"
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
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9.75m0 0l2.25-2.25M9.75 15l2.25 2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6.75A2.25 2.25 0 0018 4.5H6A2.25 2.25 0 003.75 6.75v11.25c0 1.243 1.007 2.25 2.25 2.25z"
            />
          </svg>
          <h3 class="font-display text-lg text-gray-400">No files yet</h3>
          <p class="mt-2 max-w-xs text-sm leading-relaxed text-gray-600">
            Upload Excel files to get started. Your files are private and only visible to you.
          </p>
        </div>

        <!-- No search results -->
        <div
          v-else-if="filteredFiles.length === 0"
          class="flex flex-col items-center justify-center py-20 text-center"
        >
          <p class="text-sm text-gray-500">
            No files match "<span class="text-gray-300">{{ searchQuery }}</span>"
          </p>
        </div>

        <!-- File list -->
        <div v-else class="space-y-2">
          <div
            v-for="file in filteredFiles"
            :key="file.id"
            class="group flex items-center justify-between rounded-lg border border-white/5 bg-surface-light px-4 py-3 transition-colors hover:border-white/10"
          >
            <div class="flex items-center gap-3 min-w-0">
              <!-- Excel icon -->
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <svg
                  class="h-5 w-5 text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M10.875 12h-1.5m1.5 0c.621 0 1.125.504 1.125 1.125M12 12h7.5m-7.5 0c0 .621-.504 1.125-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5m0-1.5c0-.621.504-1.125 1.125-1.125m0 0h7.5"
                  />
                </svg>
              </div>
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-gray-200">{{ file.original_name }}</p>
                <p class="text-xs text-gray-500">
                  {{ formatSize(file.size_bytes) }} &middot; {{ formatDate(file.created_at) }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                class="rounded px-2.5 py-1 text-xs text-gray-400 hover:bg-white/5 hover:text-brand-400 transition-colors"
                @click="handleDownloadFile(file)"
              >
                Open
              </button>
              <button
                type="button"
                :disabled="deletingFileId === file.id"
                class="rounded p-1.5 text-gray-600 hover:bg-white/5 hover:text-red-400 transition-colors disabled:opacity-50"
                @click="handleDeleteFile(file)"
              >
                <svg
                  v-if="deletingFileId === file.id"
                  class="h-3.5 w-3.5 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <svg
                  v-else
                  class="h-3.5 w-3.5"
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
            </div>
          </div>
        </div>
      </div>

      <!-- RECORDS TAB -->
      <div v-if="activeTab === 'records'">
        <!-- Loading -->
        <div v-if="records.loading" class="flex items-center justify-center py-20">
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

        <!-- Empty -->
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

        <!-- No search results -->
        <div
          v-else-if="filteredRecords.length === 0"
          class="flex flex-col items-center justify-center py-20 text-center"
        >
          <p class="text-sm text-gray-500">
            No records match "<span class="text-gray-300">{{ searchQuery }}</span>"
          </p>
        </div>

        <!-- Records table -->
        <table v-else class="w-full text-sm">
          <thead class="border-b border-white/5">
            <tr>
              <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Name</th>
              <th class="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Sources</th>
              <th class="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Rows</th>
              <th class="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Cols</th>
              <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Date</th>
              <th class="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            <tr
              v-for="record in filteredRecords"
              :key="record.id"
              class="group transition-colors hover:bg-white/[0.02]"
            >
              <td class="max-w-xs truncate px-4 py-3 font-medium text-gray-200">
                {{ record.name }}
              </td>
              <td class="px-4 py-3 text-right tabular-nums text-gray-500">
                {{ record.source_count }}
              </td>
              <td class="px-4 py-3 text-right tabular-nums text-gray-500">
                {{ record.row_count }}
              </td>
              <td class="px-4 py-3 text-right tabular-nums text-gray-500">
                {{ record.col_count }}
              </td>
              <td class="px-4 py-3 text-gray-500">{{ formatDate(record.created_at) }}</td>
              <td class="px-4 py-3">
                <div
                  class="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <button
                    type="button"
                    :disabled="openingRecordId === record.id"
                    class="rounded px-2.5 py-1 text-xs text-gray-400 hover:bg-white/5 hover:text-brand-400 transition-colors disabled:opacity-50"
                    @click="handleOpenRecord(record)"
                  >
                    <svg
                      v-if="openingRecordId === record.id"
                      class="inline-block h-3.5 w-3.5 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        class="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        stroke-width="4"
                      />
                      <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                    <span v-else>Open</span>
                  </button>
                  <button
                    type="button"
                    :disabled="deletingRecordId === record.id"
                    class="rounded p-1.5 text-gray-600 hover:bg-white/5 hover:text-red-400 transition-colors disabled:opacity-50"
                    @click="handleDeleteRecord(record)"
                  >
                    <svg
                      v-if="deletingRecordId === record.id"
                      class="h-3.5 w-3.5 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        class="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        stroke-width="4"
                      />
                      <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                    <svg
                      v-else
                      class="h-3.5 w-3.5"
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
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
