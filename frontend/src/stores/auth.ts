// frontend/src/stores/auth.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export interface AuthUser {
  id: string          // UUID (was number)
  display_name: string
  role?: string
  org_id?: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const checked = ref(false)

  const isAdmin = computed(() =>
    user.value?.role === 'super_admin' || user.value?.role === 'coe_admin'
  )
  const orgId = computed(() => user.value?.org_id ?? null)

  async function checkSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await _loadProfile(session.access_token)
      } else {
        user.value = null
      }
    } catch {
      user.value = null
    } finally {
      checked.value = true
    }
  }

  async function login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    await _loadProfile(data.session.access_token)
    checked.value = true
  }

  async function logout() {
    await supabase.auth.signOut()
    user.value = null
  }

  async function _loadProfile(accessToken: string) {
    const resp = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!resp.ok) throw new Error('Profile not found')
    user.value = await resp.json()
  }

  return { user, checked, isAdmin, orgId, checkSession, login, logout }
})
