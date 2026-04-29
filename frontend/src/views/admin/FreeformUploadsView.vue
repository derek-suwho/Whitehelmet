<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/composables/useApi'

interface UploadedFile {
  id: string
  original_filename: string
  uploaded_at: string
  user_id: string
}

const files = ref<UploadedFile[]>([])
const uploading = ref(false)
const loadError = ref('')
const uploadError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

async function loadFiles() {
  try {
    files.value = await api.get<UploadedFile[]>('/api/files')
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load files'
  }
}

onMounted(loadFiles)

async function handleUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = true
  uploadError.value = ''
  try {
    await api.upload('/api/files/upload', file)
    input.value = ''
    await loadFiles()
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : 'Upload failed'
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col flex-1 min-h-0 bg-gray-50">
    <div class="px-6 py-4 bg-white border-b border-gray-200">
      <h1 class="text-lg font-semibold text-gray-800">Freeform Uploads</h1>
      <p class="text-sm text-gray-500 mt-0.5">Upload raw files without a template for ad-hoc consolidation.</p>
    </div>

    <div class="flex-1 overflow-y-auto p-6">
      <!-- Upload area -->
      <div
        class="bg-white border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors mb-6"
        @click="fileInput?.click()"
      >
        <svg class="mx-auto mb-3 h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
        </svg>
        <p class="text-sm font-medium text-gray-600">{{ uploading ? 'Uploading…' : 'Click to upload a file' }}</p>
        <p class="text-xs text-gray-400 mt-1">Excel (.xlsx), CSV (.csv)</p>
        <input
          ref="fileInput"
          type="file"
          accept=".xlsx,.xls,.csv"
          class="hidden"
          @change="handleUpload"
        />
      </div>

      <p v-if="uploadError" class="mb-4 text-sm text-red-600">{{ uploadError }}</p>

      <!-- Files table -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <span class="text-sm font-medium text-gray-700">Uploaded Files</span>
          <span class="text-xs text-gray-400">{{ files.length }} file{{ files.length !== 1 ? 's' : '' }}</span>
        </div>
        <div v-if="loadError" class="px-5 py-4 text-sm text-red-500">{{ loadError }}</div>
        <div v-else-if="!files.length" class="px-5 py-8 text-sm text-gray-400 text-center">No files uploaded yet.</div>
        <table v-else class="w-full text-sm">
          <thead class="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th class="px-5 py-2.5 text-left font-medium">Filename</th>
              <th class="px-5 py-2.5 text-left font-medium">Uploaded</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="f in files" :key="f.id" class="hover:bg-gray-50">
              <td class="px-5 py-3 font-medium text-gray-800">{{ f.original_filename }}</td>
              <td class="px-5 py-3 text-gray-500">{{ new Date(f.uploaded_at).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
