import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/lib/api'
import type { Organization, Profile } from '@/types/database'

export interface UserWithOrg extends Profile {
  organization?: Pick<Organization, 'name' | 'type'> | null
}

export const useAdminStore = defineStore('admin', () => {
  const organizations = ref<Organization[]>([])
  const users = ref<UserWithOrg[]>([])

  async function fetchOrganizations() {
    const data = await api<Organization[]>('/admin/organizations')
    organizations.value = data
  }

  async function createOrganization(
    name: string,
    type: 'pif' | 'devco',
    parentOrgId?: string,
  ): Promise<Organization> {
    const data = await api<Organization>('/admin/organizations', {
      method: 'POST',
      body: JSON.stringify({ name, type, parent_org_id: parentOrgId ?? null }),
    })
    organizations.value.push(data)
    return data
  }

  async function fetchUsers() {
    const data = await api<UserWithOrg[]>('/admin/users')
    users.value = data
  }

  async function createUser(
    email: string,
    displayName: string,
    orgId: string,
    role: 'pif_admin' | 'devco_admin' | 'devco_user',
  ): Promise<void> {
    await api('/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, display_name: displayName, org_id: orgId, role }),
    })
    await fetchUsers()
  }

  async function updateUserRole(
    userId: string,
    role: 'pif_admin' | 'devco_admin' | 'devco_user',
  ): Promise<void> {
    await api(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    })
    const u = users.value.find((u) => u.id === userId)
    if (u) u.role = role
  }

  return {
    organizations,
    users,
    fetchOrganizations,
    createOrganization,
    fetchUsers,
    createUser,
    updateUserRole,
  }
})
