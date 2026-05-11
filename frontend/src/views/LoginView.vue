<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const step = ref<'email' | 'password'>('email')
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const error = ref('')
const loading = ref(false)

function continueFromEmail() {
  error.value = ''
  if (!email.value.trim()) {
    error.value = 'Email is required.'
    return
  }
  step.value = 'password'
}

async function handleLogin() {
  error.value = ''
  if (!password.value) {
    error.value = 'Password is required.'
    return
  }
  loading.value = true
  try {
    await auth.login(email.value.trim(), password.value)
    router.push({ name: 'dashboard' })
  } catch (err) {
    if (err instanceof Error) {
      error.value = err.message.includes('401') ? 'Invalid email or password.' : err.message
    } else {
      error.value = 'Login failed. Please try again.'
    }
  } finally {
    loading.value = false
  }
}

function editEmail() {
  step.value = 'email'
  password.value = ''
  error.value = ''
}
</script>

<template>
  <div class="relative flex min-h-screen flex-col bg-gradient-to-br from-sky-100 via-blue-50 to-white">
    <!-- Language selector -->
    <div class="absolute right-6 top-4 flex items-center gap-1.5 text-sm text-gray-500 select-none">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253" />
      </svg>
      EN
    </div>

    <!-- Card -->
    <div class="flex flex-1 items-center justify-center px-4 py-12">
      <div class="w-full max-w-[440px] rounded-2xl border border-gray-200 bg-white px-10 py-10 shadow-lg">

        <!-- Logo row -->
        <div class="mb-7 flex items-center gap-3">
          <!-- Shield/hexagon logo -->
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="10" fill="#3730a3"/>
            <!-- cloud icon -->
            <path d="M33 28a4 4 0 00-3.874-5.995A6 6 0 0018 25a4 4 0 000 8h14a3 3 0 001-5.83V28z" fill="white" opacity="0.9"/>
          </svg>
          <div>
            <div class="text-base font-bold text-gray-900 leading-tight">WhiteHelmet</div>
            <div class="text-xs text-gray-400 mt-0.5">Real-time capture with AI</div>
          </div>
        </div>

        <!-- Heading -->
        <h1 class="mb-7 text-2xl font-bold text-gray-900">Welcome Back</h1>

        <!-- Step 1: Email -->
        <Transition name="fade" mode="out-in">
          <div v-if="step === 'email'" key="email">
            <!-- Email field -->
            <label class="mb-1.5 block text-sm font-medium text-gray-700">
              Email <span class="text-red-500">*</span>
            </label>
            <div class="relative mb-5">
              <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </span>
              <input
                v-model="email"
                type="email"
                autocomplete="email"
                placeholder="user@whitehelmet.sa"
                class="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-800 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                @keyup.enter="continueFromEmail"
              />
            </div>

            <!-- Error -->
            <p v-if="error" class="mb-3 text-sm text-red-500">{{ error }}</p>

            <!-- Continue -->
            <button
              type="button"
              class="w-full rounded-lg bg-brand-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2"
              @click="continueFromEmail"
            >
              Continue
            </button>

            <!-- Can't sign in -->
            <p class="mt-5 text-center text-sm text-gray-500">
              <a href="#" class="hover:text-gray-700">Can't Sign in?</a>
            </p>
          </div>

          <!-- Step 2: Password -->
          <div v-else key="password">
            <!-- Email readonly -->
            <label class="mb-1.5 block text-sm font-medium text-gray-700">
              Email <span class="text-red-500">*</span>
            </label>
            <div class="relative mb-4">
              <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </span>
              <input
                :value="email"
                type="email"
                readonly
                class="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-10 text-sm text-gray-500 cursor-default focus:outline-none"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                @click="editEmail"
                title="Edit email"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                </svg>
              </button>
            </div>

            <!-- Password field -->
            <label class="mb-1.5 block text-sm font-medium text-gray-700">
              Password <span class="text-red-500">*</span>
            </label>
            <div class="relative mb-3">
              <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </span>
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="Enter password..."
                class="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-800 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                @keyup.enter="handleLogin"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                @click="showPassword = !showPassword"
              >
                <!-- eye-slash when visible -->
                <svg v-if="showPassword" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
                <!-- eye when hidden -->
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>

            <!-- Can't sign in -->
            <a href="#" class="mb-3 block text-sm font-medium text-brand-600 hover:text-brand-700">Can't sign in?</a>

            <!-- Remember me -->
            <label class="mb-5 flex cursor-pointer items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
              Remember me
            </label>

            <!-- Error -->
            <p v-if="error" class="mb-3 text-sm text-red-500">{{ error }}</p>

            <!-- Continue -->
            <button
              type="button"
              :disabled="loading"
              class="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2"
              :class="loading ? 'cursor-not-allowed bg-brand-400' : 'bg-brand-500 hover:bg-brand-600'"
              @click="handleLogin"
            >
              <template v-if="loading">
                <svg class="mr-2 inline-block h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Signing in...
              </template>
              <template v-else>Continue</template>
            </button>
          </div>
        </Transition>

      </div>
    </div>

    <!-- Footer -->
    <p class="py-4 text-center text-xs text-gray-400">
      © 2025 WhiteHelmet, Inc. All rights reserved.
    </p>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
