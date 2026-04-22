import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/composables/useApi'

export interface AuthUser {
  id: number
  external_id: string
  email: string
  display_name: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const csrfToken = ref('')
  const checked = ref(false)

  async function checkSession() {
    try {
      const resp = await api.get<{ user: AuthUser; csrf_token: string }>('/api/auth/me')
      user.value = resp.user
      csrfToken.value = resp.csrf_token
    } catch {
      user.value = null
    } finally {
      checked.value = true
    }
  }

  async function login(email: string, password: string) {
    const resp = await api.post<{ user: AuthUser; csrf_token: string }>('/api/auth/login', { email, password })
    user.value = resp.user
    csrfToken.value = resp.csrf_token
  }

  async function register(email: string, password: string, displayName: string) {
    await api.post('/api/auth/register', {
      email,
      password,
      display_name: displayName,
    })
  }

  async function logout() {
    await api.post('/api/auth/logout')
    user.value = null
    csrfToken.value = ''
  }

  return { user, csrfToken, checked, checkSession, login, register, logout }
})
