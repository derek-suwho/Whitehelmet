<script setup lang="ts">
import { ref } from 'vue'
import { api } from '@/composables/useApi'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; created: [templateId: string] }>()

const importing = ref(false)
const error = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

async function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.name.match(/\.xlsx?$/i)) {
    error.value = 'Only .xlsx / .xls files are supported.'
    return
  }
  error.value = ''
  importing.value = true
  try {
    const result = await api.upload<{ template_id: string }>('/api/ai/import-template', file)
    emit('created', result.template_id)
    emit('close')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Import failed'
  } finally {
    importing.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

function onDrop(e: DragEvent) {
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  const dt = new DataTransfer()
  dt.items.add(file)
  if (fileInput.value) {
    fileInput.value.files = dt.files
    fileInput.value.dispatchEvent(new Event('change'))
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 class="font-semibold text-gray-800">Import Template</h2>
          <button class="text-gray-400 hover:text-gray-600 text-lg" @click="$emit('close')">✕</button>
        </div>

        <div class="p-5">
          <label
            class="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-10 transition-colors"
            :class="importing
              ? 'border-blue-300 bg-blue-50 cursor-wait'
              : 'border-gray-300 hover:border-blue-400 cursor-pointer'"
            @dragover.prevent
            @drop.prevent="onDrop"
          >
            <template v-if="importing">
              <div class="w-8 h-8 mb-3 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <span class="text-sm text-blue-600 font-medium">Importing…</span>
              <span class="text-xs text-gray-400 mt-1">Detecting columns and creating template</span>
            </template>
            <template v-else>
              <svg class="w-10 h-10 mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
              </svg>
              <span class="text-sm text-gray-600 font-medium">Click to upload or drag & drop</span>
              <span class="text-xs text-gray-400 mt-1">.xlsx and .xls files — all sheets supported</span>
            </template>
            <input
              ref="fileInput"
              type="file"
              accept=".xlsx,.xls"
              class="hidden"
              :disabled="importing"
              @change="onFileChange"
            />
          </label>

          <div v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</div>
        </div>

        <div class="flex justify-end px-5 py-4 border-t border-gray-200">
          <button
            :disabled="importing"
            class="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            @click="$emit('close')"
          >Cancel</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
