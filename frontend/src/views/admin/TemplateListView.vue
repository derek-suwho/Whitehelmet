<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTemplatesStore } from '@/stores/templates'
import TemplateStatusBadge from '@/components/template/TemplateStatusBadge.vue'
import ImportTemplateModal from './modals/ImportTemplateModal.vue'
import type { Template } from '@/types/database'

const templatesStore = useTemplatesStore()
const router = useRouter()

const activeFilter = ref<'all' | 'draft' | 'active' | 'deprecated'>('all')
const showImportModal = ref(false)
const showNewMenu = ref(false)

onMounted(() => templatesStore.fetchTemplates())

const filtered = computed(() => {
  if (activeFilter.value === 'all') return templatesStore.templates
  return templatesStore.templates.filter((t) => t.status === activeFilter.value)
})

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

async function duplicate(template: Template) {
  const copy = await templatesStore.createTemplate(`${template.name} (copy)`, template.description ?? '')
  router.push(`/admin/templates/${copy.id}/edit`)
}

function onImportCreated(templateId: string) {
  showImportModal.value = false
  router.push(`/admin/templates/${templateId}/edit`)
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-semibold text-gray-800">Templates</h1>
      <div class="relative">
        <button
          class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1"
          @click="showNewMenu = !showNewMenu"
        >
          + New Template <span class="text-xs">▾</span>
        </button>
        <div
          v-if="showNewMenu"
          class="absolute right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-44 z-10"
        >
          <button
            class="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
            @click="showImportModal = true; showNewMenu = false"
          >📂 Upload Excel</button>
          <button
            class="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
            @click="router.push('/admin/templates/new?ai=true'); showNewMenu = false"
          >✨ Build with AI</button>
        </div>
      </div>
    </div>

    <!-- Filter tabs -->
    <div class="flex gap-1 mb-5 border-b border-gray-200">
      <button
        v-for="f in ['all', 'draft', 'active', 'deprecated'] as const"
        :key="f"
        class="px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors"
        :class="activeFilter === f
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700'"
        @click="activeFilter = f"
      >
        {{ f }}
      </button>
    </div>

    <!-- Template list -->
    <div class="space-y-3">
      <div
        v-for="template in filtered"
        :key="template.id"
        class="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between hover:border-gray-300 transition-colors"
      >
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="font-medium text-gray-800">{{ template.name }}</span>
            <TemplateStatusBadge :status="template.status" />
          </div>
          <div class="text-xs text-gray-400">Updated {{ formatDate(template.updated_at) }}</div>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <RouterLink
            :to="`/admin/templates/${template.id}/edit`"
            class="text-blue-600 hover:underline"
          >Edit</RouterLink>
          <RouterLink
            :to="`/admin/templates/${template.id}`"
            class="text-gray-500 hover:underline"
          >History</RouterLink>
          <button
            v-if="template.status !== 'deprecated'"
            class="text-gray-400 hover:text-gray-600"
            @click="templatesStore.deprecateTemplate(template.id)"
          >Deprecate</button>
          <button class="text-gray-400 hover:text-gray-600" @click="duplicate(template)">Duplicate</button>
        </div>
      </div>

      <div v-if="filtered.length === 0" class="text-center py-12 text-gray-400">
        No templates yet. Create one to get started.
      </div>
    </div>
  </div>

  <ImportTemplateModal
    :open="showImportModal"
    @close="showImportModal = false"
    @created="onImportCreated"
  />
</template>
