import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api, setCsrfToken } from '@/lib/api'

interface AuthUser {
  id: string
  email: string
  display_name: string
}

interface AuthProfile {
  role: 'pif_admin' | 'devco_admin' | 'devco_user' | null
  org_id: string | null
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const profile = ref<AuthProfile | null>(null)
  const checked = ref(false)

  const isAdmin = computed(() => profile.value?.role === 'pif_admin')
  const orgId = computed(() => profile.value?.org_id ?? null)

  async function checkSession() {
    try {
      const data = await api<{
        external_id: string
        email: string
        display_name: string
        system_role: string | null
        org_external_id: string | null
      }>('/auth/me')
      user.value = { id: data.external_id, email: data.email, display_name: data.display_name }
      profile.value = {
        role: (data.system_role as AuthProfile['role']) ?? null,
        org_id: data.org_external_id ?? null,
      }
    } catch {
      user.value = null
      profile.value = null
    } finally {
      checked.value = true
    }
  }

  async function login(email: string, password: string) {
    const data = await api<{ user: { external_id: string; email: string; display_name: string }; csrf_token: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    )
    setCsrfToken(data.csrf_token)
    user.value = { id: data.user.external_id, email: data.user.email, display_name: data.user.display_name }
    profile.value = { role: null, org_id: null }
    // Fetch full profile with role
    await checkSession()
  }

  async function register(email: string, password: string, displayName: string) {
    await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, display_name: displayName }),
    })
  }

  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' })
    } finally {
      setCsrfToken('')
      user.value = null
      profile.value = null
    }
  }

  return { user, profile, checked, isAdmin, orgId, checkSession, login, register, logout }
})
