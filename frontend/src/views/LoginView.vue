<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  if (!username.value.trim() || !password.value) {
    error.value = 'Username and password are required.'
    return
  }

  loading.value = true
  try {
    await auth.login(username.value.trim(), password.value)
    router.push({ name: 'workspace' })
  } catch (err) {
    if (err instanceof Error) {
      error.value = err.message.includes('401')
        ? 'Invalid username or password.'
        : err.message
    } else {
      error.value = 'Login failed. Please try again.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-surface px-4">
    <!-- Subtle background gradient -->
    <div
      class="pointer-events-none fixed inset-0"
      aria-hidden="true"
    >
      <div class="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/3 blur-3xl" />
    </div>

    <div class="relative w-full max-w-sm">
      <!-- Logo -->
      <div class="mb-8 text-center">
        <h1 class="font-display text-3xl tracking-tight text-brand-400">Whitehelmet</h1>
        <p class="mt-2 text-sm text-gray-500">Construction data consolidation</p>
      </div>

      <!-- Card -->
      <form
        class="rounded-xl border border-white/5 bg-surface-light p-6 shadow-2xl shadow-black/30"
        @submit.prevent="handleSubmit"
      >
        <!-- Error -->
        <div
          v-if="error"
          class="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300"
          role="alert"
        >
          {{ error }}
        </div>

        <!-- Username -->
        <div class="mb-4">
          <label
            for="login-username"
            class="mb-1.5 block text-sm font-medium text-gray-400"
          >
            Username
          </label>
          <input
            id="login-username"
            v-model="username"
            type="text"
            autocomplete="username"
            required
            class="w-full rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 transition-colors duration-200 focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
            placeholder="Enter your username"
          />
        </div>

        <!-- Password -->
        <div class="mb-6">
          <label
            for="login-password"
            class="mb-1.5 block text-sm font-medium text-gray-400"
          >
            Password
          </label>
          <input
            id="login-password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            class="w-full rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 transition-colors duration-200 focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
            placeholder="Enter your password"
          />
        </div>

        <!-- Submit -->
        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-light"
          :class="
            loading
              ? 'cursor-not-allowed bg-brand-600/50 text-brand-200'
              : 'bg-brand-500 text-surface shadow-lg shadow-brand-500/20 hover:bg-brand-400 active:bg-brand-600'
          "
        >
          <template v-if="loading">
            <svg
              class="mr-2 inline-block h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Signing in...
          </template>
          <template v-else>Sign in</template>
        </button>
      </form>
    </div>
  </div>
</template>
