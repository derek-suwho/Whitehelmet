<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/composables/useApi'
import { useAdminStore } from '@/stores/admin'
import type { TemplateAssignment } from '@/types/database'

const props = defineProps<{ open: boolean; templateVersionId: string }>()
const emit = defineEmits<{ close: []; assigned: [] }>()

const adminStore = useAdminStore()
const mode = ref<'template' | 'freeform'>('template')
const selectedOrgIds = ref<string[]>([])
const selectedOrgId = ref('')
const deadline = ref('')
const instructions = ref('')
const loading = ref(false)
const error = ref('')
const successUrl = ref('')

onMounted(() => adminStore.fetchOrganizations())
const devcoOrgs = () => adminStore.organizations.filter((o) => o.type === 'devco')

async function assign() {
  error.value = ''
  loading.value = true
  try {
    if (mode.value === 'template') {
      if (!selectedOrgIds.value.length) throw new Error('Select at least one DevCo.')
      if (!deadline.value) throw new Error('Deadline is required.')
      await api.post<TemplateAssignment[]>('/api/assignments', {
        template_version_id: props.templateVersionId,
        org_ids: selectedOrgIds.value,
        deadline: deadline.value,
        submission_type: 'template',
      })
      emit('assigned')
      emit('close')
    } else {
      if (!selectedOrgId.value) throw new Error('Select a DevCo.')
      const assignments = await api.post<TemplateAssignment[]>('/api/assignments', {
        org_id: selectedOrgId.value,
        org_ids: [],
        submission_type: 'freeform',
        instructions: instructions.value || undefined,
        deadline: deadline.value || undefined,
      })
      const token = assignments[0]?.upload_token
      successUrl.value = token ? `${window.location.origin}/upload/${token}` : ''
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed'
  } finally {
    loading.value = false
  }
}

function copyUrl() { navigator.clipboard.writeText(successUrl.value) }
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 class="font-semibold text-gray-800">Assign Template</h2>
          <button class="text-gray-400 hover:text-gray-600 text-lg" @click="$emit('close')">✕</button>
        </div>

        <div class="p-5 space-y-4">
          <!-- Mode toggle -->
          <div class="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            <button
              class="flex-1 py-2 font-medium transition-colors"
              :class="mode === 'template' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'"
              @click="mode = 'template'"
            >Send with Template</button>
            <button
              class="flex-1 py-2 font-medium transition-colors"
              :class="mode === 'freeform' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'"
              @click="mode = 'freeform'"
            >Freeform Upload</button>
          </div>

          <!-- Template mode -->
          <template v-if="mode === 'template'">
            <div>
              <label class="block text-xs text-gray-500 mb-1">DevCo organizations</label>
              <div class="border rounded-lg divide-y max-h-44 overflow-y-auto">
                <label
                  v-for="org in devcoOrgs()"
                  :key="org.id"
                  class="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                >
                  <input v-model="selectedOrgIds" type="checkbox" :value="org.id" class="rounded" />
                  {{ org.name }}
                </label>
                <div v-if="!devcoOrgs().length" class="px-3 py-3 text-xs text-gray-400">No DevCo orgs found</div>
              </div>
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Deadline *</label>
              <input v-model="deadline" type="date" class="block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </template>

          <!-- Freeform mode -->
          <template v-else>
            <div v-if="successUrl" class="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
              <div class="font-medium text-green-700 mb-1">Upload link generated</div>
              <div class="flex gap-2">
                <input :value="successUrl" readonly class="flex-1 text-xs bg-white border rounded px-2 py-1 truncate" />
                <button class="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700" @click="copyUrl">Copy</button>
              </div>
            </div>
            <template v-else>
              <div>
                <label class="block text-xs text-gray-500 mb-1">DevCo organization</label>
                <select v-model="selectedOrgId" class="block w-full rounded border border-gray-300 px-3 py-2 text-sm">
                  <option value="">Select…</option>
                  <option v-for="org in devcoOrgs()" :key="org.id" :value="org.id">{{ org.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Instructions (optional)</label>
                <textarea
                  v-model="instructions"
                  rows="3"
                  placeholder="Tell the DevCo what file to upload"
                  class="block w-full rounded border border-gray-300 px-3 py-2 text-sm resize-none"
                />
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Deadline (optional)</label>
                <input v-model="deadline" type="date" class="block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <p class="text-xs text-gray-500">The DevCo will upload their own Excel file. You can merge freeform submissions into the consolidated sheet using AI fine-tuning.</p>
            </template>
          </template>

          <div v-if="error" class="text-sm text-red-600">{{ error }}</div>
        </div>

        <div class="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button class="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100" @click="$emit('close')">
            {{ successUrl ? 'Close' : 'Cancel' }}
          </button>
          <button
            v-if="!successUrl"
            :disabled="loading"
            class="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            @click="assign"
          >
            {{ loading ? 'Sending…' : mode === 'template' ? 'Assign & Send' : 'Send Freeform Link' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
