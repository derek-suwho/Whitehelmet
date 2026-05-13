<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAdminStore } from '@/stores/admin'
import type { UserWithProject } from '@/stores/admin'

const adminStore = useAdminStore()
const showInviteModal = ref(false)
const email = ref('')
const displayName = ref('')
const role = ref<'super_admin' | 'coe_admin' | 'participant'>('participant')
const saving = ref(false)
const error = ref('')

// Manage-projects modal
const managingUser = ref<UserWithProject | null>(null)
const selectedProjectIds = ref<Set<string>>(new Set())
const manageLoading = ref(false)
const manageError = ref('')

// Edit org name
const editingOrgId = ref<string | null>(null)
const editingOrgName = ref('')
const orgNameSaving = ref(false)
const orgNameError = ref('')

onMounted(() => {
  adminStore.fetchUsers()
  adminStore.fetchProjects()
  adminStore.fetchOrgs()
})

function effectiveRole(user: UserWithProject): string {
  if (user.role === 'super_admin') return 'super_admin'
  if (user.role === 'coe_admin') return 'coe_admin'
  const pr = user.participant_role ?? user.projects?.[0]?.participant_role
  if (pr === 'focal') return 'focal'
  if (pr === 'viewer') return 'viewer'
  return 'member'
}

function roleBadgeClass(r: string) {
  if (r === 'super_admin') return 'bg-purple-100 text-purple-700'
  if (r === 'coe_admin') return 'bg-indigo-100 text-indigo-700'
  if (r === 'focal') return 'bg-blue-100 text-blue-700'
  if (r === 'member') return 'bg-gray-100 text-gray-600'
  if (r === 'viewer') return 'bg-gray-100 text-gray-500'
  return 'bg-gray-100 text-gray-600'
}

function roleBadgeLabel(r: string) {
  const map: Record<string, string> = { super_admin: 'super admin', coe_admin: 'coe admin', focal: 'focal member', member: 'member', viewer: 'viewer' }
  return map[r] ?? r
}

async function changeRole(user: UserWithProject, combined: string) {
  const roleMap: Record<string, { role: 'super_admin' | 'coe_admin' | 'participant'; pr?: 'focal' | 'member' | 'viewer' }> = {
    super_admin: { role: 'super_admin' },
    coe_admin: { role: 'coe_admin' },
    focal: { role: 'participant', pr: 'focal' },
    member: { role: 'participant', pr: 'member' },
    viewer: { role: 'participant', pr: 'viewer' },
  }
  const m = roleMap[combined]
  if (m) await adminStore.updateUserRole(user.id as unknown as number, m.role, m.pr)
}

async function invite() {
  if (!email.value || !displayName.value) { error.value = 'All fields are required.'; return }
  saving.value = true
  error.value = ''
  try {
    await adminStore.createUser(email.value, displayName.value, role.value)
    showInviteModal.value = false
    email.value = ''
    displayName.value = ''
    role.value = 'participant'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed'
  } finally {
    saving.value = false
  }
}

function openManageProjects(user: UserWithProject) {
  managingUser.value = user
  selectedProjectIds.value = new Set((user.projects ?? []).map(p => p.project_id))
  manageError.value = ''
}

function toggleProject(projectId: string) {
  const next = new Set(selectedProjectIds.value)
  if (next.has(projectId)) next.delete(projectId)
  else next.add(projectId)
  selectedProjectIds.value = next
}

async function saveProjectAssignments() {
  const user = managingUser.value
  if (!user) return
  manageLoading.value = true
  manageError.value = ''
  try {
    const current = new Map((user.projects ?? []).map(p => [p.project_id, p.membership_id]))
    const desired = selectedProjectIds.value
    for (const [pid, mid] of current.entries()) {
      if (!desired.has(pid)) await adminStore.removeUserFromProject(pid, mid)
    }
    for (const pid of desired) {
      if (!current.has(pid)) await adminStore.addUserToProject(pid, user.id)
    }
    await adminStore.fetchUsers()
    managingUser.value = null
  } catch (e) {
    manageError.value = e instanceof Error ? e.message : 'Save failed'
  } finally {
    manageLoading.value = false
  }
}

async function saveOrgName() {
  if (!editingOrgId.value || !editingOrgName.value.trim()) return
  orgNameSaving.value = true
  orgNameError.value = ''
  try {
    await adminStore.updateOrgName(editingOrgId.value, editingOrgName.value.trim())
    editingOrgId.value = null
  } catch (e) {
    orgNameError.value = e instanceof Error ? e.message : 'Save failed'
  } finally {
    orgNameSaving.value = false
  }
}

function startEditOrgNameFn(orgId: string, currentName: string | null) {
  editingOrgId.value = orgId
  editingOrgName.value = currentName ?? ''
  orgNameError.value = ''
}
</script>

<template>
  <div class="p-6 space-y-8">
    <!-- Users section -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-xl font-semibold text-gray-800">Users</h1>
        <button class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700" @click="showInviteModal = true">+ Invite User</button>
      </div>
      <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-5 py-3 text-left font-medium text-gray-500">Name</th>
              <th class="px-5 py-3 text-left font-medium text-gray-500">Organization</th>
              <th class="px-5 py-3 text-left font-medium text-gray-500">Projects</th>
              <th class="px-5 py-3 text-left font-medium text-gray-500">Role</th>
              <th class="px-5 py-3 text-left font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="user in adminStore.users" :key="user.id" class="hover:bg-gray-50">
              <td class="px-5 py-3 font-medium text-gray-800">{{ user.display_name }}</td>
              <td class="px-5 py-3 text-gray-500 text-xs">{{ user.org_name ?? (user.org_id ? '—' : '') }}</td>
              <td class="px-5 py-3">
                <span v-if="!user.projects?.length" class="text-gray-400">—</span>
                <div v-else class="flex flex-wrap gap-1">
                  <span v-for="p in user.projects" :key="p.project_id" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 font-medium">{{ p.project_name }}</span>
                </div>
              </td>
              <td class="px-5 py-3">
                <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize" :class="roleBadgeClass(effectiveRole(user))">{{ roleBadgeLabel(effectiveRole(user)) }}</span>
              </td>
              <td class="px-5 py-3">
                <div class="flex items-center gap-3">
                  <select :value="effectiveRole(user)" class="rounded border border-gray-200 text-xs px-2 py-1" @change="changeRole(user, ($event.target as HTMLSelectElement).value)">
                    <option value="super_admin">Super Admin</option>
                    <option value="coe_admin">COE Admin</option>
                    <option disabled>── Participant ──</option>
                    <option value="focal">Focal Member</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button class="text-xs text-violet-600 hover:text-violet-800 font-medium" @click="openManageProjects(user)">Manage Projects</button>
                </div>
              </td>
            </tr>
            <tr v-if="adminStore.users.length === 0">
              <td colspan="5" class="px-5 py-8 text-center text-gray-400">No users found</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Organizations section -->
    <div>
      <h2 class="text-lg font-semibold text-gray-800 mb-4">Organizations</h2>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="org in adminStore.orgs" :key="org.org_id" class="bg-white border border-gray-200 rounded-xl p-4">
          <!-- Org name header -->
          <div class="flex items-center gap-2 mb-3">
            <template v-if="editingOrgId === org.org_id">
              <input
                v-model="editingOrgName"
                class="flex-1 text-sm font-semibold text-gray-900 bg-transparent border-b border-violet-400 focus:outline-none px-1"
                @keydown.enter="saveOrgName"
                @keydown.escape="editingOrgId = null"
                autofocus
              />
              <button :disabled="orgNameSaving" class="text-xs text-violet-600 hover:text-violet-800 font-medium" @click="saveOrgName">{{ orgNameSaving ? 'Saving…' : 'Save' }}</button>
              <button class="text-xs text-gray-400 hover:text-gray-600" @click="editingOrgId = null">Cancel</button>
            </template>
            <template v-else>
              <span class="text-sm font-semibold text-gray-800 flex-1">{{ org.org_name ?? 'Unnamed org' }}</span>
              <button class="text-xs text-gray-400 hover:text-violet-600" @click="startEditOrgNameFn(org.org_id, org.org_name)">Edit name</button>
            </template>
          </div>
          <p v-if="editingOrgId === org.org_id && orgNameError" class="text-xs text-red-500 mb-2">{{ orgNameError }}</p>
          <!-- Member list -->
          <ul class="space-y-1">
            <li v-for="m in org.members" :key="m.email" class="text-xs text-gray-600 flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0"></span>
              {{ m.display_name }}
              <span class="text-gray-400 ml-auto truncate">{{ m.email }}</span>
            </li>
          </ul>
        </div>
        <div v-if="!adminStore.orgs.length" class="text-sm text-gray-400">No organizations found.</div>
      </div>
    </div>
  </div>

  <!-- Invite modal -->
  <Teleport to="body">
    <div v-if="showInviteModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 class="font-semibold text-gray-800">Invite User</h2>
          <button class="text-gray-400 hover:text-gray-600 text-lg" @click="showInviteModal = false">✕</button>
        </div>
        <div class="p-5 space-y-3">
          <div>
            <label class="block text-xs text-gray-500 mb-1">Email *</label>
            <input v-model="email" type="email" class="block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Display name *</label>
            <input v-model="displayName" type="text" class="block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Role *</label>
            <select v-model="role" class="block w-full rounded border border-gray-300 px-3 py-2 text-sm">
              <option value="super_admin">Super Admin</option>
              <option value="coe_admin">COE Admin</option>
              <option value="participant">Participant</option>
            </select>
          </div>
          <div v-if="error" class="text-sm text-red-600">{{ error }}</div>
        </div>
        <div class="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button class="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100" @click="showInviteModal = false">Cancel</button>
          <button :disabled="saving" class="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50" @click="invite">{{ saving ? 'Inviting…' : 'Send Invite' }}</button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Manage Projects modal -->
  <Teleport to="body">
    <div v-if="managingUser" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="managingUser = null">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 class="font-semibold text-gray-800">Manage Projects</h2>
            <p class="text-xs text-gray-500 mt-0.5">{{ managingUser.display_name }}</p>
          </div>
          <button class="text-gray-400 hover:text-gray-600 text-lg" @click="managingUser = null">✕</button>
        </div>
        <div class="p-5">
          <p class="text-xs text-gray-500 mb-3">Select which projects this user belongs to:</p>
          <div class="border border-gray-200 rounded-lg divide-y max-h-72 overflow-y-auto">
            <label v-for="project in adminStore.projects" :key="project.id" class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50">
              <input type="checkbox" :checked="selectedProjectIds.has(project.id)" class="rounded border-gray-300" @change="toggleProject(project.id)" />
              <span class="text-sm text-gray-800 font-medium">{{ project.name }}</span>
            </label>
            <div v-if="!adminStore.projects.length" class="px-4 py-3 text-sm text-gray-400">No projects available</div>
          </div>
          <div v-if="manageError" class="mt-3 text-sm text-red-600">{{ manageError }}</div>
        </div>
        <div class="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button class="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100" @click="managingUser = null">Cancel</button>
          <button :disabled="manageLoading" class="px-4 py-2 rounded bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50" @click="saveProjectAssignments">{{ manageLoading ? 'Saving…' : 'Save' }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
