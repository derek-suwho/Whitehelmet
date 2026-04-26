<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

function goToRecords() {
  router.push({ name: 'dashboard' })
}

async function handleLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header
    class="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-white/5 bg-surface px-5"
  >
    <!-- Left: Logo -->
    <router-link
      :to="{ name: 'workspace' }"
      class="font-display text-xl tracking-tight text-brand-400 transition-opacity duration-200 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      Whitehelmet
    </router-link>

    <!-- Right: Actions -->
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="rounded-md border border-brand-600/40 bg-brand-600/10 px-3 py-1.5 text-sm font-medium text-brand-300 transition-colors duration-200 hover:bg-brand-600/20 hover:text-brand-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:bg-brand-600/30"
        aria-label="Open records dashboard"
        @click="goToRecords"
      >
        Records
      </button>

      <span
        v-if="auth.user"
        class="hidden text-sm text-gray-400 sm:inline"
      >
        {{ auth.profile?.display_name ?? auth.user?.email }}
      </span>

      <button
        v-if="auth.user"
        type="button"
        class="rounded-md px-3 py-1.5 text-sm text-gray-400 transition-colors duration-200 hover:bg-white/5 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:bg-white/10"
        aria-label="Log out"
        @click="handleLogout"
      >
        Logout
      </button>
    </div>
  </header>
</template>
