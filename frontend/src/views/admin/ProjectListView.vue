<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStore } from '@/stores/admin'

const adminStore = useAdminStore()
const router = useRouter()

const showForm = ref(false)
const newName = ref('')
const newDesc = ref('')
const saving = ref(false)
const error = ref('')

onMounted(() => adminStore.fetchProjects())

async function create() {
  if (!newName.value.trim()) return
  saving.value = true
  error.value = ''
  try {
    const p = await adminStore.createProject(newName.value.trim(), newDesc.value.trim() || undefined)
    newName.value = ''
    newDesc.value = ''
    showForm.value = false
    router.push({ name: 'admin-project-detail', params: { projectId: p.id } })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to create project'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-semibold text-gray-800">Projects</h1>
      <button
        class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        @click="showForm = !showForm"
      >+ New Project</button>
    </div>

    <!-- Inline create form -->
    <div v-if="showForm" class="bg-white border border-gray-200 rounded-xl p-4 mb-5 space-y-3">
      <div>
        <label class="block text-xs text-gray-500 mb-1">Project name *</label>
        <input
          v-model="newName"
          type="text"
          placeholder="e.g. QHSE Q1 2026"
          class="block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          @keydown.enter="create"
        />
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">Description</label>
        <input
          v-model="newDesc"
          type="text"
          placeholder="Optional"
          class="block w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div v-if="error" class="text-sm text-red-600">{{ error }}</div>
      <div class="flex gap-2">
        <button
          :disabled="saving || !newName.trim()"
          class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          @click="create"
        >{{ saving ? 'Creating…' : 'Create' }}</button>
        <button class="text-gray-400 hover:text-gray-600 text-sm px-2" @click="showForm = false">Cancel</button>
      </div>
    </div>

    <!-- Project list -->
    <div class="space-y-3">
      <div
        v-for="project in adminStore.projects"
        :key="project.id"
        class="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between hover:border-gray-300 transition-colors cursor-pointer"
        @click="router.push({ name: 'admin-project-detail', params: { projectId: project.id } })"
      >
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="font-medium text-gray-800">{{ project.name }}</span>
            <span
              class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
              :class="project.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
            >{{ project.status }}</span>
          </div>
          <div v-if="project.description" class="text-xs text-gray-400">{{ project.description }}</div>
          <div class="text-xs text-gray-400 mt-1">Created {{ new Date(project.created_at).toLocaleDateString() }}</div>
        </div>
        <span class="text-blue-600 text-sm hover:underline" @click.stop="router.push({ name: 'admin-project-detail', params: { projectId: project.id } })">
          View →
        </span>
      </div>

      <div v-if="adminStore.projects.length === 0 && !showForm" class="text-center py-12 text-gray-400 text-sm">
        No projects yet. Create one to get started.
      </div>
    </div>
  </div>
</template>
