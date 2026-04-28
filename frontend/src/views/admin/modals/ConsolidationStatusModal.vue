<script setup lang="ts">
defineProps<{
  open: boolean
  loading: boolean
  result: {
    consolidated_sheet_id: string
    file_path: string
    freeform_count: number
    template_count: number
  } | null
  error: string
}>()

const emit = defineEmits<{ close: []; download: [] }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 text-center">
        <template v-if="loading">
          <div class="text-4xl mb-3 animate-spin">⏳</div>
          <div class="font-medium text-gray-700">Consolidating submissions…</div>
          <div class="text-sm text-gray-400 mt-1">This may take a moment</div>
        </template>

        <template v-else-if="result">
          <div class="text-4xl mb-3">✅</div>
          <div class="font-medium text-gray-800">Consolidation complete</div>
          <div class="text-sm text-gray-500 mt-2">
            {{ result.template_count }} template + {{ result.freeform_count }} freeform submissions
          </div>
          <div v-if="result.freeform_count > 0" class="mt-2 text-xs text-yellow-700 bg-yellow-50 rounded px-3 py-2">
            Freeform submissions are included as raw sheets. Use AI fine-tuning to map their columns.
          </div>
          <div class="flex gap-2 mt-4 justify-center">
            <button
              class="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              @click="$emit('download')"
            >
              Download Master Sheet
            </button>
            <button
              class="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100"
              @click="$emit('close')"
            >
              Close
            </button>
          </div>
        </template>

        <template v-else-if="error">
          <div class="text-4xl mb-3">❌</div>
          <div class="font-medium text-red-700">Consolidation failed</div>
          <div class="text-sm text-gray-500 mt-1">{{ error }}</div>
          <button
            class="mt-4 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100"
            @click="$emit('close')"
          >Close</button>
        </template>
      </div>
    </div>
  </Teleport>
</template>
