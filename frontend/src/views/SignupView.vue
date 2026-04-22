<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const displayName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)

function validate(): string | null {
  if (!displayName.value.trim()) return 'Display name is required.'
  if (!email.value.trim()) return 'Email is required.'
  if (password.value.length < 8) return 'Password must be at least 8 characters.'
  if (password.value !== confirmPassword.value) return 'Passwords do not match.'
  return null
}

async function handleSubmit() {
  error.value = ''
  const validationError = validate()
  if (validationError) {
    error.value = validationError
    return
  }

  loading.value = true
  try {
    await auth.register(email.value.trim(), password.value, displayName.value.trim())
    // Auto-login after registration
    await auth.login(email.value.trim(), password.value)
    router.push({ name: 'dashboard' })
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes('409')) {
        error.value = 'An account with this email already exists.'
      } else {
        error.value = err.message
      }
    } else {
      error.value = 'Registration failed. Please try again.'
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
        <p class="mt-2 text-sm text-gray-500">Create your account</p>
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

        <!-- Display Name -->
        <div class="mb-4">
          <label
            for="signup-name"
            class="mb-1.5 block text-sm font-medium text-gray-400"
          >
            Display Name
          </label>
          <input
            id="signup-name"
            v-model="displayName"
            type="text"
            autocomplete="name"
            required
            class="w-full rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 transition-colors duration-200 focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
            placeholder="Enter your name"
          />
        </div>

        <!-- Email -->
        <div class="mb-4">
          <label
            for="signup-email"
            class="mb-1.5 block text-sm font-medium text-gray-400"
          >
            Email
          </label>
          <input
            id="signup-email"
            v-model="email"
            type="email"
            autocomplete="email"
            required
            class="w-full rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 transition-colors duration-200 focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
            placeholder="Enter your email"
          />
        </div>

        <!-- Password -->
        <div class="mb-4">
          <label
            for="signup-password"
            class="mb-1.5 block text-sm font-medium text-gray-400"
          >
            Password
          </label>
          <input
            id="signup-password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            required
            class="w-full rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 transition-colors duration-200 focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
            placeholder="At least 8 characters"
          />
        </div>

        <!-- Confirm Password -->
        <div class="mb-6">
          <label
            for="signup-confirm"
            class="mb-1.5 block text-sm font-medium text-gray-400"
          >
            Confirm Password
          </label>
          <input
            id="signup-confirm"
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            required
            class="w-full rounded-lg border border-white/10 bg-surface px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 transition-colors duration-200 focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
            placeholder="Re-enter your password"
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
            Creating account...
          </template>
          <template v-else>Create Account</template>
        </button>

        <!-- Login link -->
        <p class="mt-4 text-center text-sm text-gray-500">
          Already have an account?
          <router-link
            :to="{ name: 'login' }"
            class="text-brand-400 transition-colors hover:text-brand-300"
          >
            Sign in
          </router-link>
        </p>
      </form>
    </div>
  </div>
</template>
