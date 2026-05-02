<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTemplatesStore } from '@/stores/templates'
import TemplateStatusBadge from '@/components/template/TemplateStatusBadge.vue'
import ImportTemplateModal from './modals/ImportTemplateModal.vue'

const router = useRouter()
const templatesStore = useTemplatesStore()

const loading = ref(true)
const showCreateModal = ref(false)
const showImportModal = ref(false)
const newName = ref('')
const newDesc = ref('')
const creating = ref(false)
const createError = ref('')
const editingId = ref<string | null>(null)
const editingName = ref('')

function startRename(t: { id: string; name: string }, e: MouseEvent) {
  e.stopPropagation()
  editingId.value = t.id
  editingName.value = t.name
}

async function commitRename(t: { id: string; name: string }) {
  const name = editingName.value.trim()
  if (name && name !== t.name) {
    await templatesStore.updateTemplate(t.id, name)
    await templatesStore.fetchTemplates()
  }
  editingId.value = null
}

function cancelRename() {
  editingId.value = null
}

onMounted(async () => {
  await templatesStore.fetchTemplates()
  loading.value = false
})

const masterTemplates = computed(() =>
  [...templatesStore.templates.filter(t => t.template_type === 'master')]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
)

function openCreateModal() {
  newName.value = ''
  newDesc.value = ''
  createError.value = ''
  showCreateModal.value = true
}

async function createMaster() {
  if (!newName.value.trim()) { createError.value = 'Name is required.'; return }
  creating.value = true
  createError.value = ''
  try {
    const t = await templatesStore.createTemplate(newName.value.trim(), newDesc.value.trim(), 'master')
    showCreateModal.value = false
    router.push(`/admin/templates/${t.id}/edit`)
  } catch (e) {
    createError.value = e instanceof Error ? e.message : 'Failed to create'
  } finally {
    creating.value = false
  }
}

async function onImportCreated(templateId: string) {
  showImportModal.value = false
  await templatesStore.setTemplateType(templateId, 'master')
  router.push(`/admin/templates/${templateId}/edit`)
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <div class="p-6 overflow-y-auto flex-1 min-h-0 space-y-6">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-800">Master Template</h1>
        <p class="mt-0.5 text-sm text-gray-500">
          The central KPI output schema — defines the consolidated sheet structure across all subcontractor submissions.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
          @click="showImportModal = true"
        >Import Excel</button>
        <button
          class="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600"
          @click="openCreateModal"
        >+ Create Master Template</button>
      </div>
    </div>

    <!-- Skeleton -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 2" :key="i" class="h-20 rounded-xl border border-gray-200 bg-white animate-pulse" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!masterTemplates.length"
      class="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50"
    >
      <svg class="mb-4 h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>
      <p class="text-sm font-semibold text-gray-600">No master template yet</p>
      <p class="mt-1 text-xs text-gray-400 max-w-xs">
        Create or import a master template to define your consolidated KPI output structure.
      </p>
      <div class="mt-6 flex gap-3">
        <button
          class="border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
          @click="showImportModal = true"
        >Import from Excel</button>
        <button
          class="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600"
          @click="openCreateModal"
        >+ Create Master Template</button>
      </div>
    </div>

    <!-- Master templates list -->
    <div v-else class="space-y-3">
      <div
        v-for="t in masterTemplates"
        :key="t.id"
        class="bg-white border rounded-xl p-4 flex items-start justify-between hover:border-amber-300 hover:shadow-sm transition-all cursor-pointer"
        :class="t.status === 'active' ? 'border-amber-300 ring-1 ring-amber-100' : 'border-gray-200'"
        @click="router.push(`/admin/templates/${t.id}/edit`)"
      >
        <div>
          <div class="flex items-center gap-2 mb-1" @click.stop>
            <!-- Crown icon for master -->
            <svg class="h-4 w-4 text-amber-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 5l4 4 4-7 4 7 4-4-2 9H4L2 5z"/>
            </svg>
            <input
              v-if="editingId === t.id"
              v-model="editingName"
              class="font-medium text-gray-800 border border-amber-400 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 w-56"
              @blur="commitRename(t)"
              @keydown.enter="commitRename(t)"
              @keydown.escape="cancelRename"
              autofocus
            />
            <span
              v-else
              class="font-medium text-gray-800 hover:text-amber-600 transition-colors cursor-text"
              title="Click to rename"
              @click="startRename(t, $event)"
            >{{ t.name }}</span>
            <TemplateStatusBadge :status="t.status" />
          </div>
          <p v-if="t.description" class="text-xs text-gray-400 ml-6">{{ t.description }}</p>
          <p class="text-xs text-gray-400 mt-0.5 ml-6">Updated {{ formatDate(t.updated_at) }}</p>
        </div>
        <div class="flex items-center gap-3 text-sm shrink-0 ml-4" @click.stop>
          <RouterLink :to="`/admin/templates/${t.id}/edit`" class="text-blue-600 hover:underline text-xs">Edit</RouterLink>
          <RouterLink :to="`/admin/templates/${t.id}`" class="text-gray-500 hover:underline text-xs">History</RouterLink>
          <RouterLink :to="`/admin/consolidations/${t.id}`" class="text-green-600 hover:underline text-xs font-medium">Consolidate</RouterLink>
          <button
            v-if="t.status !== 'deprecated'"
            class="text-gray-400 hover:text-gray-600 text-xs"
            @click="templatesStore.deprecateTemplate(t.id)"
          >Deprecate</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Create Modal -->
  <Teleport to="body">
    <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 class="font-semibold text-gray-800">New Master Template</h2>
          <button class="text-gray-400 hover:text-gray-600 text-lg" @click="showCreateModal = false">✕</button>
        </div>
        <div class="p-5 space-y-4">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Name *</label>
            <input
              v-model="newName"
              type="text"
              placeholder="e.g. QHSE Master KPI Sheet"
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              @keydown.enter="createMaster"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Description <span class="font-normal text-gray-400">(optional)</span></label>
            <input
              v-model="newDesc"
              type="text"
              placeholder="What is this master template for?"
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div v-if="createError" class="text-sm text-red-600">{{ createError }}</div>
        </div>
        <div class="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button class="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100" @click="showCreateModal = false">Cancel</button>
          <button
            :disabled="creating"
            class="px-4 py-2 rounded bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
            @click="createMaster"
          >{{ creating ? 'Creating…' : 'Create & Edit' }}</button>
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
