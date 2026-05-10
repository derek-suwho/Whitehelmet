<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAdminStore } from '@/stores/admin'

const adminStore = useAdminStore()
const showInviteModal = ref(false)
const email = ref('')
const displayName = ref('')
const role = ref<'org_super_admin' | 'org_admin' | 'org_member'>('org_member')
const saving = ref(false)
const error = ref('')

onMounted(() => {
  adminStore.fetchUsers()
  adminStore.fetchProjects()
})

function roleBadge(r: string) {
  if (r === 'org_super_admin') return 'bg-purple-100 text-purple-700'
  if (r === 'org_admin') return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-600'
}

async function invite() {
  if (!email.value || !displayName.value) {
    error.value = 'All fields are required.'
    return
  }
  saving.value = true
  error.value = ''
  try {
    await adminStore.createUser(email.value, displayName.value, role.value)
    showInviteModal.value = false
    email.value = ''
    displayName.value = ''
    role.value = 'org_member'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed'
  } finally {
    saving.value = false
  }
}

async function changeRole(userId: number, newRole: 'org_super_admin' | 'org_admin' | 'org_member') {
  await adminStore.updateUserRole(userId, newRole)
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-semibold text-gray-800">Users</h1>
      <button
        class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        @click="showInviteModal = true"
      >+ Invite User</button>
    </div>

    <!-- Table -->
    <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Name</th>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Project</th>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Role</th>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="user in adminStore.users" :key="user.id" class="hover:bg-gray-50">
            <td class="px-5 py-3 font-medium text-gray-800">{{ user.display_name }}</td>
            <td class="px-5 py-3 text-gray-500">
              {{ user.project_name ?? '—' }}
            </td>
            <td class="px-5 py-3">
              <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" :class="roleBadge(user.role ?? '')">
                {{ (user.role ?? '—').replaceAll('_', ' ') }}
              </span>
            </td>
            <td class="px-5 py-3">
              <select
                :value="user.role ?? ''"
                class="rounded border border-gray-200 text-xs px-2 py-1"
                @change="changeRole(user.id, ($event.target as HTMLSelectElement).value as 'org_super_admin' | 'org_admin' | 'org_member')"
              >
                <option value="org_super_admin">Org Super Admin</option>
                <option value="org_admin">Org Admin</option>
                <option value="org_member">Org Member</option>
              </select>
            </td>
          </tr>
          <tr v-if="adminStore.users.length === 0">
            <td colspan="4" class="px-5 py-8 text-center text-gray-400">No users found</td>
          </tr>
        </tbody>
      </table>
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
              <option value="org_super_admin">Org Super Admin</option>
              <option value="org_admin">Org Admin</option>
              <option value="org_member">Org Member</option>
            </select>
          </div>
          <div v-if="error" class="text-sm text-red-600">{{ error }}</div>
        </div>
        <div class="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button class="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100" @click="showInviteModal = false">Cancel</button>
          <button
            :disabled="saving"
            class="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            @click="invite"
          >{{ saving ? 'Inviting…' : 'Send Invite' }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
