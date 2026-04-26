import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Organization, Profile } from '@/types/database'

export interface UserWithOrg extends Profile {
  organization?: Pick<Organization, 'name' | 'type'> | null
}

export const useAdminStore = defineStore('admin', () => {
  const organizations = ref<Organization[]>([])
  const users = ref<UserWithOrg[]>([])

  async function fetchOrganizations() {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('name')
    if (error) throw error
    organizations.value = data
  }

  async function createOrganization(
    name: string,
    type: 'pif' | 'devco',
    parentOrgId?: string,
  ): Promise<Organization> {
    const { data, error } = await supabase
      .from('organizations')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({ name, type, parent_org_id: parentOrgId ?? null } as any)
      .select()
      .single()
    if (error) throw error
    organizations.value.push(data)
    return data
  }

  async function fetchUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, organization:organizations(name, type)')
      .order('display_name')
    if (error) throw error
    users.value = data as UserWithOrg[]
  }

  async function createUser(
    email: string,
    displayName: string,
    orgId: string,
    role: 'pif_admin' | 'devco_admin' | 'devco_user',
  ): Promise<void> {
    // Invite user via Supabase Edge Function (service role required for admin.inviteUserByEmail)
    const { error } = await supabase.functions.invoke('g2-invite-user', {
      body: { email, display_name: displayName, org_id: orgId, role },
    })
    if (error) throw error
    await fetchUsers()
  }

  async function updateUserRole(
    userId: string,
    role: 'pif_admin' | 'devco_admin' | 'devco_user',
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('profiles')
      .update({ role })
      .eq('id', userId)
    if (error) throw error
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
