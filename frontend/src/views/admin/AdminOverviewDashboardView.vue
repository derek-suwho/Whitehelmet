<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTemplatesStore } from '@/stores/templates'
import { useAdminStore } from '@/stores/admin'

const router = useRouter()
const templatesStore = useTemplatesStore()
const adminStore = useAdminStore()

const loading = ref(true)

onMounted(async () => {
  await Promise.all([
    templatesStore.fetchTemplates(),
    adminStore.fetchProjects(),
    adminStore.fetchUsers(),
  ])
  loading.value = false
})

const subTemplates = computed(() => templatesStore.templates.filter(t => t.template_type !== 'master'))
const masterTemplate = computed(() => templatesStore.templates.find(t => t.template_type === 'master' && t.status === 'active')
  ?? templatesStore.templates.find(t => t.template_type === 'master'))

const activeCount = computed(() => subTemplates.value.filter(t => t.status === 'active').length)
const draftCount = computed(() => subTemplates.value.filter(t => t.status === 'draft').length)
const projectCount = computed(() => adminStore.projects.length)
const userCount = computed(() => adminStore.users.length)

const recentTemplates = computed(() =>
  [...subTemplates.value]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 6)
)

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const quickActions = [
  {
    label: 'Create Template',
    description: 'Define a new KPI template for DevCos',
    icon: 'M12 4v16m8-8H4',
    color: 'bg-blue-50 text-blue-600',
    route: 'admin-templates',
  },
  {
    label: 'Track Submissions',
    description: 'View submission status across projects',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    color: 'bg-green-50 text-green-600',
    route: 'admin-templates',
  },
  {
    label: 'Upload Files',
    description: 'Upload and consolidate spreadsheets',
    icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
    color: 'bg-purple-50 text-purple-600',
    route: 'admin-freeform-uploads',
  },
  {
    label: 'Formula Library',
    description: 'Manage QHSE calculation formulas',
    icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    color: 'bg-amber-50 text-amber-600',
    route: 'admin-formulas',
  },
]
</script>

<template>
  <div class="p-6 overflow-y-auto flex-1 min-h-0 space-y-8">

    <!-- Page header -->
    <div>
      <h1 class="text-xl font-semibold text-gray-800">Overview</h1>
      <p class="mt-0.5 text-sm text-gray-500">Dashboard summary for Whitehelmet</p>
    </div>

    <!-- Stat cards skeleton -->
    <div v-if="loading" class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div v-for="i in 4" :key="i" class="h-24 rounded-xl border border-gray-200 bg-white animate-pulse" />
    </div>

    <!-- Stat cards -->
    <div v-else class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <!-- Master Template card — links to master template page -->
      <RouterLink
        to="/admin/master-template"
        class="rounded-xl border bg-white p-5 transition-shadow hover:shadow-sm"
        :class="masterTemplate ? 'border-amber-300 bg-amber-50' : 'border-dashed border-gray-300'"
      >
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Master Template</p>
        <p v-if="masterTemplate" class="mt-2 text-sm font-semibold text-amber-700 truncate">{{ masterTemplate.name }}</p>
        <p v-else class="mt-2 text-sm text-gray-400 italic">Not set — click to create</p>
      </RouterLink>
      <div class="rounded-xl border border-gray-200 bg-white p-5">
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Active Sub-Templates</p>
        <p class="mt-2 text-3xl font-bold text-gray-900">{{ activeCount }}</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-5">
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Projects</p>
        <p class="mt-2 text-3xl font-bold text-gray-900">{{ projectCount }}</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-5">
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">Users</p>
        <p class="mt-2 text-3xl font-bold text-gray-900">{{ userCount }}</p>
      </div>
    </div>

    <!-- Quick actions -->
    <div>
      <h2 class="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h2>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button
          v-for="action in quickActions"
          :key="action.label"
          class="flex flex-col items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all"
          @click="router.push({ name: action.route })"
        >
          <div :class="['flex h-9 w-9 items-center justify-center rounded-lg', action.color]">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" :d="action.icon" />
            </svg>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-800">{{ action.label }}</p>
            <p class="mt-0.5 text-xs text-gray-400">{{ action.description }}</p>
          </div>
        </button>
      </div>
    </div>

    <!-- Recent Templates skeleton -->
    <div v-if="loading">
      <div class="h-5 w-36 rounded bg-gray-200 animate-pulse mb-3" />
      <div class="space-y-2">
        <div v-for="i in 4" :key="i" class="h-12 rounded-lg bg-gray-100 animate-pulse" />
      </div>
    </div>

    <!-- Recent Templates table -->
    <div v-else-if="recentTemplates.length">
      <h2 class="text-sm font-semibold text-gray-700 mb-3">Recent Templates</h2>
      <div class="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table class="min-w-full divide-y divide-gray-100 text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Name</th>
              <th class="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Status</th>
              <th class="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Updated</th>
              <th class="px-5 py-3" />
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="t in recentTemplates"
              :key="t.id"
              class="hover:bg-gray-50 transition-colors cursor-pointer"
              @click="router.push(`/admin/templates/${t.id}/edit`)"
            >
              <td class="px-5 py-3 font-medium text-gray-800">{{ t.name }}</td>
              <td class="px-5 py-3">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="{
                    'bg-green-100 text-green-700': t.status === 'active',
                    'bg-amber-100 text-amber-700': t.status === 'draft',
                    'bg-gray-100 text-gray-500': t.status === 'deprecated',
                  }"
                >{{ t.status }}</span>
              </td>
              <td class="px-5 py-3 text-gray-400 text-xs">{{ formatDate(t.updated_at) }}</td>
              <td class="px-5 py-3 text-right">
                <span class="text-xs text-blue-600 hover:underline">Edit</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </div>
</template>
