<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTemplatesStore } from '@/stores/templates'
import TemplateStatusBadge from '@/components/template/TemplateStatusBadge.vue'
import VersionHistoryTable from '@/components/template/VersionHistoryTable.vue'

const route = useRoute()
const router = useRouter()
const templatesStore = useTemplatesStore()

onMounted(() => templatesStore.fetchTemplate(route.params.id as string))

async function deprecate() {
  if (!confirm('Deprecate this template? Existing assignments will remain.')) return
  await templatesStore.deprecateTemplate(route.params.id as string)
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center gap-3 mb-6">
      <RouterLink to="/admin/templates" class="text-gray-400 hover:text-gray-600 text-sm">← Templates</RouterLink>
      <h1 class="text-xl font-semibold text-gray-800">
        {{ templatesStore.currentTemplate?.name ?? '…' }}
      </h1>
      <TemplateStatusBadge
        v-if="templatesStore.currentTemplate"
        :status="templatesStore.currentTemplate.status"
      />
    </div>

    <div class="space-y-6">
      <div class="bg-white border border-gray-200 rounded-xl p-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-medium text-gray-700">Version History</h2>
          <div class="flex gap-2">
            <RouterLink
              :to="`/admin/templates/${route.params.id}/edit`"
              class="px-3 py-1.5 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >Edit Latest</RouterLink>
            <button
              v-if="templatesStore.currentTemplate?.status !== 'deprecated'"
              class="px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
              @click="deprecate"
            >Deprecate</button>
          </div>
        </div>
        <VersionHistoryTable :versions="templatesStore.versions" />
      </div>
    </div>
  </div>
</template>
