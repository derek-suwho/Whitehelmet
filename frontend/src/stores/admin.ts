import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/composables/useApi'
import type { Project, ProjectMember, ProjectTemplateAssignment } from '@/types/database'

export interface UserWithProject {
  id: number
  external_id: string
  email: string
  display_name: string
  role?: string
  org_id?: string
}

export interface ProjectDetail extends Project {
  members: ProjectMember[]
  template_assignments: ProjectTemplateAssignment[]
}

export const useAdminStore = defineStore('admin', () => {
  const projects = ref<Project[]>([])
  const users = ref<UserWithProject[]>([])

  async function fetchProjects() {
    projects.value = await api.get<Project[]>('/api/projects')
  }

  async function createProject(name: string, description?: string): Promise<Project> {
    const p = await api.post<Project>('/api/projects', { name, description: description ?? null })
    projects.value.unshift(p)
    return p
  }

  async function fetchProjectDetail(projectId: string): Promise<ProjectDetail> {
    return api.get<ProjectDetail>(`/api/projects/${projectId}`)
  }

  async function addProjectMember(projectId: string, userId: number): Promise<void> {
    await api.post(`/api/projects/${projectId}/members`, { user_id: userId })
  }

  async function removeProjectMember(projectId: string, membershipId: string): Promise<void> {
    await api.delete(`/api/projects/${projectId}/members/${membershipId}`)
  }

  async function assignTemplateToProject(
    projectId: string,
    templateVersionId: string,
    deadline?: string,
  ): Promise<void> {
    await api.post(`/api/projects/${projectId}/assign-template`, {
      template_version_id: templateVersionId,
      deadline: deadline ?? null,
    })
  }

  async function fetchUsers() {
    users.value = await api.get<UserWithProject[]>('/api/admin/users')
  }

  async function createUser(
    email: string,
    displayName: string,
    role: 'pif_admin' | 'devco_admin' | 'devco_user',
  ): Promise<void> {
    await api.post('/api/auth/register', { email, password: 'ChangeMe123!', display_name: displayName })
    await fetchUsers()
    const created = users.value.find(u => u.email === email)
    if (created) await updateUserRole(created.id, role)
    await fetchUsers()
  }

  async function updateUserRole(
    userId: number,
    role: 'pif_admin' | 'devco_admin' | 'devco_user',
  ): Promise<void> {
    const updated = await api.patch<UserWithProject>(`/api/admin/users/${userId}/role`, { role })
    const u = users.value.find(u => u.id === userId)
    if (u) u.role = updated.role
  }

  return {
    projects,
    users,
    fetchProjects,
    createProject,
    fetchProjectDetail,
    addProjectMember,
    removeProjectMember,
    assignTemplateToProject,
    fetchUsers,
    createUser,
    updateUserRole,
  }
})
