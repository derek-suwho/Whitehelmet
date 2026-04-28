import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/composables/useApi'
import type { Organization } from '@/types/database'

export interface UserWithOrg {
  id: number
  external_id: string
  email: string
  display_name: string
  role?: string
  org_id?: string
}

export const useAdminStore = defineStore('admin', () => {
  const organizations = ref<Organization[]>([])
  const users = ref<UserWithOrg[]>([])

  async function fetchOrganizations() {
    organizations.value = await api.get<Organization[]>('/api/organizations')
  }

  async function createOrganization(
    name: string,
    type: 'pif' | 'devco',
    parentOrgId?: string,
  ): Promise<Organization> {
    const org = await api.post<Organization>('/api/organizations', {
      name, type, parent_org_id: parentOrgId ?? null,
    })
    organizations.value.push(org)
    return org
  }

  async function fetchUsers() {
    users.value = await api.get<UserWithOrg[]>('/api/admin/users')
  }

  async function createUser(
    email: string,
    displayName: string,
    orgId: string,
    role: 'pif_admin' | 'devco_admin' | 'devco_user',
  ): Promise<void> {
    // User creation handled via register endpoint; role/org assigned separately
    await api.post('/api/auth/register', { email, password: 'ChangeMe123!', display_name: displayName })
    const created = users.value.find(u => u.email === email)
    if (created) await updateUserRole(created.id, role)
    await fetchUsers()
  }

  async function updateUserRole(
    userId: number,
    role: 'pif_admin' | 'devco_admin' | 'devco_user',
  ): Promise<void> {
    const updated = await api.patch<UserWithOrg>(`/api/admin/users/${userId}/role`, { role })
    const u = users.value.find(u => u.id === userId)
    if (u) u.role = updated.role
  }

  return { organizations, users, fetchOrganizations, createOrganization, fetchUsers, createUser, updateUserRole }
})
