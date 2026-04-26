<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useTemplatesStore } from '@/stores/templates'
import type { SchemaColumn } from '@/types/database'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; created: [templateId: string] }>()

const templatesStore = useTemplatesStore()

const step = ref<1 | 2>(1)
const uploading = ref(false)
const error = ref('')
const templateName = ref('')
const parsedColumns = ref<Array<{
  name: string
  inferred_type: 'text' | 'number' | 'date' | 'percentage'
  sample_values: string[]
}>>([])
const uploadedFilePath = ref('')

async function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.name.endsWith('.xlsx')) {
    error.value = 'Only .xlsx files are supported.'
    return
  }

  error.value = ''
  uploading.value = true
  templateName.value = file.name.replace('.xlsx', '')

  try {
    const filePath = `uploads/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage.from('templates').upload(filePath, file)
    if (uploadError) throw uploadError
    uploadedFilePath.value = filePath

    const { data, error: fnError } = await supabase.functions.invoke('g2-parse-template', {
      body: { file_path: filePath },
    })
    if (fnError) throw fnError

    parsedColumns.value = data.sheets?.[0]?.columns ?? []
    step.value = 2
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Upload failed'
  } finally {
    uploading.value = false
  }
}

async function confirm() {
  if (!templateName.value.trim()) {
    error.value = 'Template name is required.'
    return
  }

  uploading.value = true
  error.value = ''
  try {
    const template = await templatesStore.createTemplate(templateName.value, '')
    const schemaJson = {
      columns: parsedColumns.value.map((c) => ({
        id: crypto.randomUUID(),
        name: c.name,
        type: c.inferred_type,
      } satisfies SchemaColumn)),
    }
    await templatesStore.saveVersion(template.id, schemaJson)
    emit('created', template.id)
    emit('close')
    reset()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to create template'
  } finally {
    uploading.value = false
  }
}

function reset() {
  step.value = 1
  parsedColumns.value = []
  templateName.value = ''
  uploadedFilePath.value = ''
  error.value = ''
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 class="font-semibold text-gray-800">
            {{ step === 1 ? 'Upload Template' : 'Preview Columns' }}
          </h2>
          <button class="text-gray-400 hover:text-gray-600 text-lg" @click="$emit('close')">✕</button>
        </div>

        <div class="p-5">
          <!-- Step 1: Upload -->
          <template v-if="step === 1">
            <label
              class="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-10 cursor-pointer hover:border-blue-400 transition-colors"
            >
              <span class="text-3xl mb-2">📂</span>
              <span class="text-sm text-gray-600">Click to upload or drag & drop</span>
              <span class="text-xs text-gray-400 mt-1">.xlsx files only</span>
              <input type="file" accept=".xlsx" class="hidden" @change="onFileChange" />
            </label>
            <div v-if="uploading" class="mt-3 text-sm text-blue-600 text-center animate-pulse">
              Uploading and parsing…
            </div>
          </template>

          <!-- Step 2: Preview -->
          <template v-else>
            <div class="mb-3">
              <label class="block text-xs text-gray-500 mb-1">Template name</label>
              <input
                v-model="templateName"
                type="text"
                class="block w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div class="overflow-y-auto max-h-60 border rounded-lg">
              <table class="w-full text-sm">
                <thead class="bg-gray-50 sticky top-0">
                  <tr>
                    <th class="px-3 py-2 text-left font-medium text-gray-500">Column</th>
                    <th class="px-3 py-2 text-left font-medium text-gray-500">Type</th>
                    <th class="px-3 py-2 text-left font-medium text-gray-500">Sample</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="(col, i) in parsedColumns" :key="i">
                    <td class="px-3 py-2">
                      <input
                        v-model="parsedColumns[i].name"
                        type="text"
                        class="w-full rounded border border-gray-200 px-1 py-0.5 text-xs"
                      />
                    </td>
                    <td class="px-3 py-2">
                      <select
                        v-model="parsedColumns[i].inferred_type"
                        class="rounded border border-gray-200 px-1 py-0.5 text-xs"
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="percentage">Percentage</option>
                      </select>
                    </td>
                    <td class="px-3 py-2 text-gray-400 text-xs truncate max-w-[120px]">
                      {{ col.sample_values.slice(0, 2).join(', ') }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

          <div v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</div>
        </div>

        <div class="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button
            class="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100"
            @click="step === 1 ? $emit('close') : (step = 1)"
          >
            {{ step === 1 ? 'Cancel' : 'Back' }}
          </button>
          <button
            v-if="step === 2"
            :disabled="uploading"
            class="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            @click="confirm"
          >
            {{ uploading ? 'Creating…' : 'Create Template' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
