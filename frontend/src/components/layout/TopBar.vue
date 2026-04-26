<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

async function handleLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <!-- Dark navy navbar — stays dark, all other panels go light -->
  <header class="fixed top-0 left-0 right-0 z-50 flex h-14 items-center gap-8 border-b border-white/5 bg-surface px-5">

    <!-- Logo -->
    <router-link :to="{ name: 'workspace' }" class="flex shrink-0 items-center gap-2.5 focus-visible:outline-none">
      <!-- WhiteHelmet hex icon -->
      <svg width="24" height="28" viewBox="0 0 28 32" fill="none" aria-hidden="true">
        <path d="M14 0L27.124 7.5V22.5L14 30L0.876 22.5V7.5L14 0Z" fill="#C8D400"/>
        <path d="M14 4L23.856 9.5V20.5L14 26L4.144 20.5V9.5L14 4Z" fill="#0F0E2A"/>
        <path d="M9 13L14 10L19 13V19L14 22L9 19V13Z" fill="#8A8A8A" opacity="0.6"/>
        <path d="M14 10L19 13V19L14 16V10Z" fill="#C8D400" opacity="0.9"/>
      </svg>
      <span class="text-[15px] font-semibold tracking-tight text-white">WhiteHelmet</span>
    </router-link>

    <!-- Nav links -->
    <nav class="flex items-center gap-1">
      <router-link
        :to="{ name: 'workspace' }"
        class="rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        :class="$route.name === 'workspace' ? 'bg-white/12 text-white' : 'text-white/60 hover:bg-white/8 hover:text-white'"
      >
        Records
      </router-link>
    </nav>

    <!-- Right: bell + avatar + kebab -->
    <div class="ml-auto flex items-center gap-2">
      <!-- Bell -->
      <button
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded-lg bg-white/8 text-white/60 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        aria-label="Notifications"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
      </button>

      <span
        v-if="auth.user"
        class="hidden text-sm text-gray-400 sm:inline"
      >
        {{ auth.user?.display_name ?? auth.user?.email }}
      </span>

      <button
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white ring-2 ring-white/20 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-brand-400"
        :title="auth.user?.display_name ?? 'Account'"
        @click="handleLogout"
      >
        {{ auth.user?.display_name?.slice(0, 2).toUpperCase() ?? 'WH' }}
      </button>

      <!-- Kebab -->
      <button
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded-lg bg-white/8 text-white/60 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        aria-label="More options"
      >
        <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
        </svg>
      </button>
    </div>

  </header>
</template>
