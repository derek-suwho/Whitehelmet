import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/composables/useApi'
import type { Template, TemplateVersion, ConsolidatedSheet, SchemaJson } from '@/types/database'

export const useTemplatesStore = defineStore('templates', () => {
  const templates = ref<Template[]>([])
  const currentTemplate = ref<Template | null>(null)
  const currentVersion = ref<TemplateVersion | null>(null)
  const versions = ref<TemplateVersion[]>([])
  const consolidatedSheets = ref<ConsolidatedSheet[]>([])

  async function fetchTemplates() {
    templates.value = await api.get<Template[]>('/api/templates')
  }

  async function fetchTemplate(id: string) {
    currentTemplate.value = await api.get<Template>(`/api/templates/${id}`)
    versions.value = await api.get<TemplateVersion[]>(`/api/templates/${id}/versions`)
    currentVersion.value = versions.value[0] ?? null
  }

  async function createTemplate(name: string, description: string): Promise<Template> {
    const tmpl = await api.post<Template>('/api/templates', { name, description })
    templates.value.unshift(tmpl)
    currentTemplate.value = tmpl
    return tmpl
  }

  async function saveVersion(templateId: string, schemaJson: SchemaJson): Promise<TemplateVersion> {
    const ver = await api.post<TemplateVersion>(
      `/api/templates/${templateId}/versions`,
      { schema_json: schemaJson },
    )
    versions.value.unshift(ver)
    currentVersion.value = ver
    return ver
  }

  async function publishTemplate(templateId: string) {
    const updated = await api.patch<Template>(`/api/templates/${templateId}/status`, { status: 'active' })
    _syncTemplate(updated)
  }

  async function deprecateTemplate(templateId: string) {
    const updated = await api.patch<Template>(`/api/templates/${templateId}/status`, { status: 'deprecated' })
    _syncTemplate(updated)
  }

  function _syncTemplate(updated: Template) {
    const idx = templates.value.findIndex(t => t.id === updated.id)
    if (idx !== -1) templates.value[idx] = updated
    if (currentTemplate.value?.id === updated.id) currentTemplate.value = updated
  }

  async function fetchConsolidatedSheets(templateId: string) {
    consolidatedSheets.value = await api.get<ConsolidatedSheet[]>(`/api/templates/${templateId}/consolidations`)
  }

  async function getDownloadUrl(sheetId: string): Promise<string> {
    return `/api/templates/consolidations/${sheetId}/download`
  }

  return {
    templates, currentTemplate, currentVersion, versions, consolidatedSheets,
    fetchTemplates, fetchTemplate, createTemplate, saveVersion,
    publishTemplate, deprecateTemplate, fetchConsolidatedSheets, getDownloadUrl,
  }
})
