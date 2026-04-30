<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAdminStore } from '@/stores/admin'
import { useTemplatesStore } from '@/stores/templates'
import type { ProjectDetail } from '@/stores/admin'
import type { ProjectMember } from '@/types/database'

const route = useRoute()
const adminStore = useAdminStore()
const templatesStore = useTemplatesStore()

const projectId = route.params.projectId as string
const project = ref<ProjectDetail | null>(null)
const loading = ref(true)
const error = ref('')

// Add member modal
const showMemberModal = ref(false)
const memberUserId = ref<number | null>(null)
const addingMember = ref(false)
const memberError = ref('')

// Assign template modal
const showTemplateModal = ref(false)
const selectedTemplateId = ref('')
const selectedVersionId = ref('')
const templateDeadline = ref('')
const assigningTemplate = ref(false)
const templateError = ref('')

onMounted(async () => {
  try {
    await Promise.all([
      loadProject(),
      adminStore.fetchUsers(),
      templatesStore.fetchTemplates(),
    ])
  } finally {
    loading.value = false
  }
})

async function loadProject() {
  project.value = await adminStore.fetchProjectDetail(projectId)
}

// Available users not already in this project
function availableUsers() {
  const memberIds = new Set((project.value?.members ?? []).map(m => m.user_id))
  return adminStore.users.filter(u => !memberIds.has(u.id))
}

// Versions for selected template
function versionsForTemplate() {
  if (!selectedTemplateId.value) return []
  return templatesStore.versions.filter(v => v.template_id === selectedTemplateId.value)
}

async function addMember() {
  if (!memberUserId.value) { memberError.value = 'Select a user.'; return }
  addingMember.value = true
  memberError.value = ''
  try {
    await adminStore.addProjectMember(projectId, memberUserId.value)
    await loadProject()
    showMemberModal.value = false
    memberUserId.value = null
  } catch (e) {
    memberError.value = e instanceof Error ? e.message : 'Failed'
  } finally {
    addingMember.value = false
  }
}

async function removeMember(m: ProjectMember) {
  try {
    await adminStore.removeProjectMember(projectId, m.membership_id)
    await loadProject()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to remove member'
  }
}

async function assignTemplate() {
  if (!selectedVersionId.value) { templateError.value = 'Select a template version.'; return }
  assigningTemplate.value = true
  templateError.value = ''
  try {
    await adminStore.assignTemplateToProject(
      projectId,
      selectedVersionId.value,
      templateDeadline.value || undefined,
    )
    await loadProject()
    showTemplateModal.value = false
    selectedTemplateId.value = ''
    selectedVersionId.value = ''
    templateDeadline.value = ''
  } catch (e) {
    templateError.value = e instanceof Error ? e.message : 'Failed'
  } finally {
    assigningTemplate.value = false
  }
}

async function onTemplateChange() {
  selectedVersionId.value = ''
  if (selectedTemplateId.value) {
    await templatesStore.fetchTemplate(selectedTemplateId.value)
  }
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div>
      <RouterLink to="/admin/projects" class="text-gray-400 hover:text-gray-600 text-sm">← Projects</RouterLink>
      <div v-if="loading" class="mt-2 h-7 w-48 animate-pulse rounded bg-gray-200" />
      <h1 v-else class="text-xl font-semibold text-gray-800 mt-1">{{ project?.name }}</h1>
      <p v-if="project?.description" class="text-sm text-gray-500 mt-0.5">{{ project.description }}</p>
    </div>

    <div v-if="error" class="text-sm text-red-600">{{ error }}</div>

    <!-- Templates section -->
    <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <h2 class="text-sm font-semibold text-gray-700">Templates</h2>
        <button
          class="text-blue-600 text-sm hover:underline"
          @click="showTemplateModal = true"
        >+ Assign Template</button>
      </div>
      <table class="min-w-full divide-y divide-gray-100 text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-5 py-2.5 text-left font-medium text-gray-500 text-xs">Template</th>
            <th class="px-5 py-2.5 text-left font-medium text-gray-500 text-xs">Status</th>
            <th class="px-5 py-2.5 text-left font-medium text-gray-500 text-xs">Deadline</th>
            <th class="px-5 py-2.5 text-left font-medium text-gray-500 text-xs">Assigned</th>
            <th class="px-5 py-2.5 text-left font-medium text-gray-500 text-xs">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="a in project?.template_assignments ?? []" :key="a.assignment_id" class="hover:bg-gray-50">
            <td class="px-5 py-3 font-medium text-gray-800">{{ a.template_name ?? a.template_version_id ?? '—' }}</td>
            <td class="px-5 py-3">
              <span
                class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                :class="{
                  'bg-amber-100 text-amber-700': a.status === 'pending',
                  'bg-green-100 text-green-700': a.status === 'submitted',
                  'bg-gray-100 text-gray-500':   a.status === 'locked',
                }"
              >{{ a.status }}</span>
            </td>
            <td class="px-5 py-3 text-gray-500">{{ formatDate(a.deadline) }}</td>
            <td class="px-5 py-3 text-gray-400">{{ formatDate(a.assigned_at) }}</td>
            <td class="px-5 py-3">
              <RouterLink
                v-if="a.template_id"
                :to="`/admin/consolidations/${a.template_id}`"
                class="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
              >Consolidate →</RouterLink>
            </td>
          </tr>
          <tr v-if="!project?.template_assignments?.length">
            <td colspan="5" class="px-5 py-8 text-center text-gray-400">No templates assigned yet.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Members section -->
    <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <h2 class="text-sm font-semibold text-gray-700">Subcontractors</h2>
        <button
          class="text-blue-600 text-sm hover:underline"
          @click="showMemberModal = true"
        >+ Add Member</button>
      </div>
      <table class="min-w-full divide-y divide-gray-100 text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-5 py-2.5 text-left font-medium text-gray-500 text-xs">Name</th>
            <th class="px-5 py-2.5 text-left font-medium text-gray-500 text-xs">Email</th>
            <th class="px-5 py-2.5 text-left font-medium text-gray-500 text-xs">Role</th>
            <th class="px-5 py-2.5 text-left font-medium text-gray-500 text-xs">Submission</th>
            <th class="px-5 py-2.5 text-left font-medium text-gray-500 text-xs">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="m in project?.members ?? []" :key="m.membership_id" class="hover:bg-gray-50">
            <td class="px-5 py-3 font-medium text-gray-800">{{ m.display_name }}</td>
            <td class="px-5 py-3 text-gray-500">{{ m.email }}</td>
            <td class="px-5 py-3 text-gray-500">{{ m.role ?? '—' }}</td>
            <td class="px-5 py-3">
              <span
                class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                :class="m.has_submission
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'"
              >{{ m.has_submission ? 'submitted' : 'pending' }}</span>
            </td>
            <td class="px-5 py-3">
              <button class="text-red-400 hover:text-red-600 text-xs" @click="removeMember(m)">Remove</button>
            </td>
          </tr>
          <tr v-if="!project?.members?.length">
            <td colspan="5" class="px-5 py-8 text-center text-gray-400">No members yet.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Add Member Modal -->
  <Teleport to="body">
    <div v-if="showMemberModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 class="font-semibold text-gray-800">Add Member</h2>
          <button class="text-gray-400 hover:text-gray-600 text-lg" @click="showMemberModal = false">✕</button>
        </div>
        <div class="p-5 space-y-3">
          <div>
            <label class="block text-xs text-gray-500 mb-1">User *</label>
            <select v-model="memberUserId" class="block w-full rounded border border-gray-300 px-3 py-2 text-sm">
              <option :value="null">Select…</option>
              <option v-for="u in availableUsers()" :key="u.id" :value="u.id">
                {{ u.display_name }} ({{ u.email }})
              </option>
            </select>
          </div>
          <div v-if="memberError" class="text-sm text-red-600">{{ memberError }}</div>
        </div>
        <div class="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button class="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100" @click="showMemberModal = false">Cancel</button>
          <button
            :disabled="addingMember"
            class="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            @click="addMember"
          >{{ addingMember ? 'Adding…' : 'Add' }}</button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Assign Template Modal -->
  <Teleport to="body">
    <div v-if="showTemplateModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 class="font-semibold text-gray-800">Assign Template</h2>
          <button class="text-gray-400 hover:text-gray-600 text-lg" @click="showTemplateModal = false">✕</button>
        </div>
        <div class="p-5 space-y-3">
          <div>
            <label class="block text-xs text-gray-500 mb-1">Template *</label>
            <select
              v-model="selectedTemplateId"
              class="block w-full rounded border border-gray-300 px-3 py-2 text-sm"
              @change="onTemplateChange"
            >
              <option value="">Select template…</option>
              <option v-for="t in templatesStore.templates" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </div>
          <div v-if="selectedTemplateId">
            <label class="block text-xs text-gray-500 mb-1">Version *</label>
            <select v-model="selectedVersionId" class="block w-full rounded border border-gray-300 px-3 py-2 text-sm">
              <option value="">Select version…</option>
              <option v-for="v in versionsForTemplate()" :key="v.id" :value="v.id">
                v{{ v.version_number }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Deadline (optional)</label>
            <input v-model="templateDeadline" type="date" class="block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div v-if="templateError" class="text-sm text-red-600">{{ templateError }}</div>
        </div>
        <div class="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button class="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100" @click="showTemplateModal = false">Cancel</button>
          <button
            :disabled="assigningTemplate"
            class="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            @click="assignTemplate"
          >{{ assigningTemplate ? 'Assigning…' : 'Assign' }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
