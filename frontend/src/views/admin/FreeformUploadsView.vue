<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/composables/useApi'

interface UploadedFile {
  id: number
  original_name: string
  size_bytes: number
  sha256: string
  created_at: string
}

const files = ref<UploadedFile[]>([])
const uploading = ref(false)
const error = ref('')
const dragOver = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

onMounted(fetchFiles)

async function fetchFiles() {
  try {
    const res = await api.get<{ files: UploadedFile[]; total: number }>('/api/files')
    files.value = res.files
  } catch {
    error.value = 'Failed to load files'
  }
}

async function uploadFile(file: File) {
  if (!file.name.match(/\.xlsx?$/i)) {
    error.value = 'Only .xlsx / .xls files are supported.'
    return
  }
  error.value = ''
  uploading.value = true
  try {
    const result = await api.upload<UploadedFile>('/api/files/upload', file)
    files.value.unshift(result)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Upload failed'
  } finally {
    uploading.value = false
  }
}

function onFileInputChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) uploadFile(file)
  if (fileInput.value) fileInput.value.value = ''
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) uploadFile(file)
}

async function download(file: UploadedFile) {
  window.open(`/api/files/${file.id}/download`, '_blank')
}

async function remove(file: UploadedFile) {
  try {
    await api.delete(`/api/files/${file.id}`)
    files.value = files.value.filter(f => f.id !== file.id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Delete failed'
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold text-gray-800">Freeform Uploads</h1>
      <button
        class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        @click="fileInput?.click()"
      >
        + Upload File
      </button>
      <input ref="fileInput" type="file" accept=".xlsx,.xls" class="hidden" @change="onFileInputChange" />
    </div>

    <!-- Drop zone -->
    <div
      class="border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors"
      :class="dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400'"
      @dragover.prevent="dragOver = true"
      @dragleave="dragOver = false"
      @drop.prevent="onDrop"
      @click="fileInput?.click()"
    >
      <svg class="h-10 w-10 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z"/>
      </svg>
      <p v-if="uploading" class="text-sm text-blue-600 animate-pulse">Uploading…</p>
      <template v-else>
        <p class="text-sm font-medium text-gray-600">Drag & drop or click to upload</p>
        <p class="text-xs text-gray-400 mt-1">.xlsx and .xls files</p>
      </template>
    </div>

    <div v-if="error" class="text-sm text-red-600">{{ error }}</div>

    <!-- File list -->
    <div v-if="files.length > 0" class="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-5 py-3 text-left font-medium text-gray-500">File</th>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Size</th>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Uploaded</th>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="file in files" :key="file.id" class="hover:bg-gray-50">
            <td class="px-5 py-3">
              <div class="flex items-center gap-2">
                <span class="text-base">📄</span>
                <span class="font-medium text-gray-800 truncate max-w-xs">{{ file.original_name }}</span>
              </div>
            </td>
            <td class="px-5 py-3 text-gray-500">{{ formatBytes(file.size_bytes) }}</td>
            <td class="px-5 py-3 text-gray-500">{{ formatDate(file.created_at) }}</td>
            <td class="px-5 py-3 flex items-center gap-3">
              <button class="text-blue-600 hover:underline text-sm" @click="download(file)">Download</button>
              <button class="text-red-400 hover:text-red-600 text-sm" @click="remove(file)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="!uploading" class="text-center py-12 text-gray-400 text-sm">
      No files uploaded yet.
    </div>
  </div>
</template>
