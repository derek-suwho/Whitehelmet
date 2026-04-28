<script setup lang="ts">
import { ref } from 'vue'
import type { TemplateVersion } from '@/types/database'

defineProps<{ versions: TemplateVersion[] }>()

const expandedId = ref<string | null>(null)

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="min-w-full divide-y divide-gray-200 text-sm">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-4 py-2 text-left font-medium text-gray-500">Version</th>
          <th class="px-4 py-2 text-left font-medium text-gray-500">Created</th>
          <th class="px-4 py-2 text-left font-medium text-gray-500">Schema</th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-100">
        <template v-for="v in versions" :key="v.id">
          <tr class="hover:bg-gray-50">
            <td class="px-4 py-2 font-medium">v{{ v.version_number }}</td>
            <td class="px-4 py-2 text-gray-500">{{ formatDate(v.created_at) }}</td>
            <td class="px-4 py-2">
              <button
                class="text-blue-600 hover:underline text-xs"
                @click="toggleExpand(v.id)"
              >
                {{ expandedId === v.id ? 'Hide' : 'View JSON' }}
              </button>
            </td>
          </tr>
          <tr v-if="expandedId === v.id">
            <td colspan="3" class="px-4 py-2 bg-gray-50">
              <pre class="text-xs text-gray-700 overflow-auto max-h-48 rounded bg-gray-100 p-2">{{ JSON.stringify(v.schema_json, null, 2) }}</pre>
            </td>
          </tr>
        </template>
        <tr v-if="versions.length === 0">
          <td colspan="3" class="px-4 py-4 text-center text-gray-400">No versions yet</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
