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
  review_status: string | null
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

export interface UserProjectEntry {
  project_id: string
  project_name: string
  membership_id: string
  participant_role: string | null
}

export interface UserWithProject {
  id: string
  email: string | null
  display_name: string
  role?: string
  org_id?: string
  org_name?: string | null
  project_name?: string | null
  participant_role?: string | null
  projects?: UserProjectEntry[]
}

export interface ProjectDetail extends Project {
  members: ProjectMember[]
  template_assignments: ProjectTemplateAssignment[]
}

export interface OrgEntry {
  org_id: string
  org_name: string | null
  members: { display_name: string; email: string }[]
}

export const useAdminStore = defineStore('admin', () => {
  const projects = ref<Project[]>([])
  const users = ref<UserWithProject[]>([])
  const orgs = ref<OrgEntry[]>([])

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

  async function addProjectMember(
    projectId: string,
    userId: number,
    participantRole: 'focal' | 'member' | 'viewer' = 'focal',
  ): Promise<void> {
    await api.post(`/api/projects/${projectId}/members`, {
      user_id: userId,
      participant_role: participantRole,
    })
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

  async function fetchOrgs(): Promise<void> {
    orgs.value = await api.get<OrgEntry[]>('/api/admin/orgs')
  }

  async function assignTemplateToOrgs(templateVersionId: string, orgIds: string[], deadline?: string): Promise<void> {
    await api.post('/api/admin/assign-template-to-org', {
      template_version_id: templateVersionId,
      org_ids: orgIds,
      deadline: deadline ?? null,
    })
  }

  async function updateOrgName(orgId: string, orgName: string): Promise<void> {
    await api.patch(`/api/admin/orgs/${encodeURIComponent(orgId)}/name`, { org_name: orgName })
    orgs.value = orgs.value.map(o => o.org_id === orgId ? { ...o, org_name: orgName } : o)
    users.value = users.value.map(u => u.org_id === orgId ? { ...u, org_name: orgName } : u)
  }

  async function addUserToProject(projectId: string, userId: string, participantRole = 'member'): Promise<void> {
    await api.post(`/api/projects/${projectId}/members`, { user_id: userId, participant_role: participantRole })
  }

  async function removeUserFromProject(projectId: string, membershipId: string): Promise<void> {
    await api.delete(`/api/projects/${projectId}/members/${membershipId}`)
  }

  async function createUser(
    email: string,
    displayName: string,
    role: 'super_admin' | 'coe_admin' | 'participant',
  ): Promise<void> {
    await api.post('/api/auth/register', { email, password: 'ChangeMe123!', display_name: displayName })
    await fetchUsers()
    const created = users.value.find(u => u.email === email)
    if (created) await updateUserRole(created.id, role)
    await fetchUsers()
  }

  async function updateUserRole(
    userId: number | string,
    role: 'super_admin' | 'coe_admin' | 'participant',
    participantRole?: 'focal' | 'member' | 'viewer',
  ): Promise<void> {
    const updated = await api.patch<UserWithProject>(`/api/admin/users/${userId}/role`, {
      role,
      participant_role: participantRole ?? null,
    })
    const u = users.value.find(u => u.id === String(userId))
    if (u) {
      u.role = updated.role
      u.participant_role = updated.participant_role
      u.projects = updated.projects
    }
  }

  async function fetchProjectSubmissions(projectId: string): Promise<ProjectSubmission[]> {
    return api.get<ProjectSubmission[]>(`/api/projects/${projectId}/submissions`)
  }

  async function deleteSubmission(submissionId: string): Promise<void> {
    await api.delete(`/api/admin/submissions/${submissionId}`)
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
    orgs,
    fetchProjects,
    fetchOrgs,
    assignTemplateToOrgs,
    createProject,
    fetchProjectDetail,
    addProjectMember,
    removeProjectMember,
    setProjectMasterTemplate,
    assignTemplateToProject,
    fetchUsers,
    updateOrgName,
    addUserToProject,
    removeUserFromProject,
    createUser,
    updateUserRole,
    fetchProjectSubmissions,
    deleteSubmission,
    fetchMasterReports,
    renameMasterReport,
    deleteMasterReport,
    downloadMasterReport,
  }
})
