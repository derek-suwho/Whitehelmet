import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/lib/api'
import type { Template, TemplateVersion, ConsolidatedSheet, SchemaJson } from '@/types/database'

export const useTemplatesStore = defineStore('templates', () => {
  const templates = ref<Template[]>([])
  const currentTemplate = ref<Template | null>(null)
  const currentVersion = ref<TemplateVersion | null>(null)
  const versions = ref<TemplateVersion[]>([])
  const consolidatedSheets = ref<ConsolidatedSheet[]>([])

  async function fetchTemplates() {
    const data: Template[] = await api('/templates')
    templates.value = data
  }

  async function fetchTemplate(id: string) {
    const data = await api<Template>(`/templates/${id}`)
    currentTemplate.value = data

    const versionData = await api<TemplateVersion[]>(`/templates/${id}/versions`)
    versions.value = versionData
    currentVersion.value = versionData[0] ?? null
  }

  async function createTemplate(name: string, description: string): Promise<Template> {
    const data = await api<Template>('/templates', {
      method: 'POST',
      body: JSON.stringify({ name, description, status: 'draft' }),
    })
    templates.value.unshift(data)
    currentTemplate.value = data
    return data
  }

  async function saveVersion(templateId: string, schemaJson: SchemaJson): Promise<TemplateVersion> {
    const nextVersion = (versions.value[0]?.version_number ?? 0) + 1
    const data: TemplateVersion = await api(`/templates/${templateId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ version_number: nextVersion, schema_json: schemaJson }),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    versions.value.unshift(data as any)
    currentVersion.value = data
    return data
  }

  async function publishTemplate(templateId: string) {
    await api(`/templates/${templateId}/publish`, { method: 'POST' })
    if (currentTemplate.value?.id === templateId) {
      currentTemplate.value.status = 'active'
    }
    const t = templates.value.find((t) => t.id === templateId)
    if (t) t.status = 'active'
  }

  async function deprecateTemplate(templateId: string) {
    await api(`/templates/${templateId}/deprecate`, { method: 'POST' })
    const t = templates.value.find((t) => t.id === templateId)
    if (t) t.status = 'deprecated'
    if (currentTemplate.value?.id === templateId) {
      currentTemplate.value.status = 'deprecated'
    }
  }

  async function fetchConsolidatedSheets(templateId: string) {
    const data = await api<ConsolidatedSheet[]>(`/templates/${templateId}/consolidations`)
    consolidatedSheets.value = data
  }

  async function getDownloadUrl(consolidatedSheetId: string): Promise<string> {
    const data = await api<{ url: string }>(`/templates/consolidations/${consolidatedSheetId}/download-url`)
    return data.url
  }

  return {
    templates,
    currentTemplate,
    currentVersion,
    versions,
    consolidatedSheets,
    fetchTemplates,
    fetchTemplate,
    createTemplate,
    saveVersion,
    publishTemplate,
    deprecateTemplate,
    fetchConsolidatedSheets,
    getDownloadUrl,
  }
})
