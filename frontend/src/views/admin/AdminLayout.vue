<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const navLinks = [
  { label: 'Overview', to: '/admin/dashboard' },
  { label: 'Master Template', to: '/admin/master-template' },
  { label: 'Subcontractor Templates', to: '/admin/templates' },
  { label: 'Projects', to: '/admin/projects' },
  { label: 'Users', to: '/admin/users' },
{ label: 'File Uploads', to: '/admin/freeform-uploads' },
  { label: 'Consolidate Files', to: '/', exact: true },
]

async function logout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="flex h-screen bg-gray-50 pt-14">
    <!-- Sidebar -->
    <aside class="w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col">
      <div class="px-5 py-4 border-b border-gray-200">
        <span class="text-sm font-semibold text-gray-800">Whitehelmet</span>
      </div>
      <nav class="flex-1 px-3 py-4 space-y-1">
        <RouterLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          :active-class="link.exact ? '' : 'bg-blue-50 text-blue-700 font-medium'"
          :exact-active-class="link.exact ? 'bg-blue-50 text-blue-700 font-medium' : ''"
        >
          {{ link.label }}
        </RouterLink>
      </nav>
      <div class="px-4 py-3 border-t border-gray-200 text-xs text-gray-500">
        <div class="font-medium text-gray-700 truncate">{{ auth.user?.display_name }}</div>
        <button class="mt-1 hover:text-red-500 transition-colors" @click="logout">Sign out</button>
      </div>
    </aside>

    <!-- Main content -->
    <main class="flex-1 overflow-hidden flex flex-col">
      <RouterView />
    </main>
  </div>
</template>
