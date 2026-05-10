import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/composables/useApi'
import type { Project, ProjectMember, ProjectTemplateAssignment } from '@/types/database'

export interface ProjectSubmission {
  id: string
  row_number: number
  file_name: string
  submitter_name: string
  reporting_period: string | null
  submitted_at: string | null
  status: string
}

export interface MasterReport {
  id: string
  template_id: string
  project_id: string | null
  name: string | null
  period: string | null
  generated_by: string | null
  generated_at: string
}

export interface UserWithProject {
  id: string
  email: string | null
  display_name: string
  role?: string
  org_id?: string
  project_name?: string | null
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

  async function setProjectMasterTemplate(
    projectId: string,
    masterTemplateId: string | null,
  ): Promise<ProjectDetail> {
    return api.patch<ProjectDetail>(`/api/projects/${projectId}/master-template`, {
      master_template_id: masterTemplateId,
    })
  }

  async function assignTemplateToProject(
    projectId: string,
    templateVersionId: string,
    deadline?: string,
    memberUserIds?: number[],
  ): Promise<void> {
    await api.post(`/api/projects/${projectId}/assign-template`, {
      template_version_id: templateVersionId,
      deadline: deadline ?? null,
      member_user_ids: memberUserIds ?? null,
    })
  }

  async function fetchUsers() {
    users.value = await api.get<UserWithProject[]>('/api/admin/users')
  }

  async function createUser(
    email: string,
    displayName: string,
    role: 'org_super_admin' | 'org_admin' | 'org_member',
  ): Promise<void> {
    await api.post('/api/auth/register', { email, password: 'ChangeMe123!', display_name: displayName })
    await fetchUsers()
    const created = users.value.find(u => u.email === email)
    if (created) await updateUserRole(created.id, role)
    await fetchUsers()
  }

  async function updateUserRole(
    userId: number,
    role: 'org_super_admin' | 'org_admin' | 'org_member',
  ): Promise<void> {
    const updated = await api.patch<UserWithProject>(`/api/admin/users/${userId}/role`, { role })
    const u = users.value.find(u => u.id === userId)
    if (u) u.role = updated.role
  }

  async function fetchProjectSubmissions(projectId: string): Promise<ProjectSubmission[]> {
    return api.get<ProjectSubmission[]>(`/api/projects/${projectId}/submissions`)
  }

  async function fetchMasterReports(projectId: string): Promise<MasterReport[]> {
    return api.get<MasterReport[]>(`/api/admin/projects/${projectId}/master-reports`)
  }

  async function renameMasterReport(sheetId: string, name: string): Promise<MasterReport> {
    return api.patch<MasterReport>(`/api/admin/consolidated-sheets/${sheetId}/rename`, { name })
  }

  async function deleteMasterReport(sheetId: string): Promise<void> {
    await api.delete(`/api/admin/consolidated-sheets/${sheetId}`)
  }

  function downloadMasterReport(sheetId: string): void {
    window.open(`/api/admin/consolidated-sheets/${sheetId}/download`, '_blank')
  }

  return {
    projects,
    users,
    fetchProjects,
    createProject,
    fetchProjectDetail,
    addProjectMember,
    removeProjectMember,
    setProjectMasterTemplate,
    assignTemplateToProject,
    fetchUsers,
    createUser,
    updateUserRole,
    fetchProjectSubmissions,
    fetchMasterReports,
    renameMasterReport,
    deleteMasterReport,
    downloadMasterReport,
  }
})
