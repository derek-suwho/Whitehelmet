<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAdminStore } from '@/stores/admin'

const adminStore = useAdminStore()
const showForm = ref(false)
const newName = ref('')
const saving = ref(false)
const error = ref('')

onMounted(() => adminStore.fetchOrganizations())

const pifOrg = () => adminStore.organizations.find((o) => o.type === 'pif')

function orgTypeBadge(type: 'pif' | 'devco') {
  return type === 'pif'
    ? 'bg-purple-100 text-purple-700'
    : 'bg-blue-100 text-blue-700'
}

async function addDevco() {
  if (!newName.value.trim()) return
  saving.value = true
  error.value = ''
  try {
    await adminStore.createOrganization(newName.value.trim(), 'devco', pifOrg()?.id)
    newName.value = ''
    showForm.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-semibold text-gray-800">Organizations</h1>
      <button
        class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        @click="showForm = !showForm"
      >+ Add DevCo</button>
    </div>

    <!-- Add DevCo form -->
    <div v-if="showForm" class="bg-white border border-gray-200 rounded-xl p-4 mb-5 flex items-end gap-3">
      <div class="flex-1">
        <label class="block text-xs text-gray-500 mb-1">DevCo name</label>
        <input
          v-model="newName"
          type="text"
          placeholder="e.g. ACWA Power"
          class="block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          @keydown.enter="addDevco"
        />
      </div>
      <button
        :disabled="saving || !newName.trim()"
        class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        @click="addDevco"
      >{{ saving ? 'Adding…' : 'Add' }}</button>
      <button class="text-gray-400 hover:text-gray-600 text-sm" @click="showForm = false">Cancel</button>
    </div>
    <div v-if="error" class="text-sm text-red-600 mb-3">{{ error }}</div>

    <!-- Table -->
    <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Name</th>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Type</th>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Parent</th>
            <th class="px-5 py-3 text-left font-medium text-gray-500">Created</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="org in adminStore.organizations" :key="org.id" class="hover:bg-gray-50">
            <td class="px-5 py-3 font-medium text-gray-800">{{ org.name }}</td>
            <td class="px-5 py-3">
              <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize" :class="orgTypeBadge(org.type)">
                {{ org.type === 'pif' ? 'PIF' : 'DevCo' }}
              </span>
            </td>
            <td class="px-5 py-3 text-gray-500">
              {{ adminStore.organizations.find((o) => o.id === org.parent_org_id)?.name ?? '—' }}
            </td>
            <td class="px-5 py-3 text-gray-400">
              {{ new Date(org.created_at).toLocaleDateString() }}
            </td>
          </tr>
          <tr v-if="adminStore.organizations.length === 0">
            <td colspan="4" class="px-5 py-8 text-center text-gray-400">No organizations found</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
