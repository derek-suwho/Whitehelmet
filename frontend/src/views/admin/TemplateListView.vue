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
const showCreateModal = ref(false)
const newName = ref('')
const newDesc = ref('')
const creating = ref(false)
const createError = ref('')

onMounted(() => templatesStore.fetchTemplates())

const filtered = computed(() => {
  if (activeFilter.value === 'all') return templatesStore.templates
  return templatesStore.templates.filter((t) => t.status === activeFilter.value)
})

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function openCreateModal() {
  newName.value = ''
  newDesc.value = ''
  createError.value = ''
  showCreateModal.value = true
}

async function createBlank() {
  if (!newName.value.trim()) { createError.value = 'Name is required.'; return }
  creating.value = true
  createError.value = ''
  try {
    const t = await templatesStore.createTemplate(newName.value.trim(), newDesc.value.trim())
    showCreateModal.value = false
    router.push(`/admin/templates/${t.id}/edit`)
  } catch (e) {
    createError.value = e instanceof Error ? e.message : 'Failed to create template'
  } finally {
    creating.value = false
  }
}

async function createWithAI() {
  if (!newName.value.trim()) { createError.value = 'Name is required.'; return }
  creating.value = true
  createError.value = ''
  try {
    const t = await templatesStore.createTemplate(newName.value.trim(), newDesc.value.trim())
    showCreateModal.value = false
    router.push(`/admin/templates/${t.id}/edit?ai=true`)
  } catch (e) {
    createError.value = e instanceof Error ? e.message : 'Failed to create template'
  } finally {
    creating.value = false
  }
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
      <div class="flex items-center gap-2">
        <button
          class="border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-1.5"
          @click="showImportModal = true"
        >📂 Import Excel</button>
        <button
          class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          @click="openCreateModal"
        >+ Create Template</button>
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
      >{{ f }}</button>
    </div>

    <!-- Empty state -->
    <div v-if="filtered.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
      <div class="text-5xl mb-4">📋</div>
      <h2 class="text-base font-semibold text-gray-700 mb-1">No templates yet</h2>
      <p class="text-sm text-gray-400 mb-6 max-w-xs">
        Create a template to define the KPI columns your subcontractors will fill in.
      </p>
      <div class="flex gap-3">
        <button
          class="border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
          @click="showImportModal = true"
        >📂 Import from Excel</button>
        <button
          class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          @click="openCreateModal"
        >+ Create Template</button>
      </div>
    </div>

    <!-- Template list -->
    <div v-else class="space-y-3">
      <div
        v-for="template in filtered"
        :key="template.id"
        class="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
        @click="router.push(`/admin/templates/${template.id}/edit`)"
      >
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="font-medium text-gray-800 hover:text-blue-600 transition-colors">{{ template.name }}</span>
            <TemplateStatusBadge :status="template.status" />
          </div>
          <div class="text-xs text-gray-400">Updated {{ formatDate(template.updated_at) }}</div>
        </div>
        <div class="flex items-center gap-2 text-sm" @click.stop>
          <RouterLink :to="`/admin/templates/${template.id}/edit`" class="text-blue-600 hover:underline">Edit</RouterLink>
          <RouterLink :to="`/admin/templates/${template.id}`" class="text-gray-500 hover:underline">History</RouterLink>
          <RouterLink :to="`/admin/consolidations/${template.id}`" class="text-green-600 hover:underline font-medium">Track Submissions</RouterLink>
          <button
            v-if="template.status !== 'deprecated'"
            class="text-gray-400 hover:text-gray-600"
            @click="templatesStore.deprecateTemplate(template.id)"
          >Deprecate</button>
          <button class="text-gray-400 hover:text-gray-600" @click="duplicate(template)">Duplicate</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Create Template Modal -->
  <Teleport to="body">
    <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 class="font-semibold text-gray-800">New Template</h2>
          <button class="text-gray-400 hover:text-gray-600 text-lg" @click="showCreateModal = false">✕</button>
        </div>
        <div class="p-5 space-y-4">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Template name *</label>
            <input
              v-model="newName"
              type="text"
              placeholder="e.g. Monthly QHSE KPIs"
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              @keydown.enter="createBlank"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Description <span class="font-normal text-gray-400">(optional)</span></label>
            <input
              v-model="newDesc"
              type="text"
              placeholder="What is this template for?"
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div v-if="createError" class="text-sm text-red-600">{{ createError }}</div>

          <!-- How to build -->
          <div>
            <p class="text-xs font-medium text-gray-500 mb-2">How would you like to build it?</p>
            <div class="grid grid-cols-2 gap-3">
              <button
                :disabled="creating"
                class="flex flex-col items-center gap-2 border-2 border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
                @click="createBlank"
              >
                <span class="text-2xl">🗂️</span>
                <div>
                  <div class="text-sm font-medium text-gray-800">Start blank</div>
                  <div class="text-xs text-gray-400 mt-0.5">Add columns manually in the editor</div>
                </div>
              </button>
              <button
                :disabled="creating"
                class="flex flex-col items-center gap-2 border-2 border-gray-200 rounded-xl p-4 hover:border-purple-400 hover:bg-purple-50 transition-colors text-left disabled:opacity-50"
                @click="createWithAI"
              >
                <span class="text-2xl">✨</span>
                <div>
                  <div class="text-sm font-medium text-gray-800">Build with AI</div>
                  <div class="text-xs text-gray-400 mt-0.5">Describe your KPIs and let AI draft the columns</div>
                </div>
              </button>
            </div>
          </div>
        </div>
        <div class="px-5 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
          Or <button class="text-blue-600 hover:underline" @click="showCreateModal = false; showImportModal = true">import from an existing Excel file</button>
        </div>
      </div>
    </div>
  </Teleport>

  <ImportTemplateModal
    :open="showImportModal"
    @close="showImportModal = false"
    @created="onImportCreated"
  />
</template>
