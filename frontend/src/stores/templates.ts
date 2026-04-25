import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Template, TemplateVersion, ConsolidatedSheet, SchemaJson } from '@/types/database'

export const useTemplatesStore = defineStore('templates', () => {
  const templates = ref<Template[]>([])
  const currentTemplate = ref<Template | null>(null)
  const currentVersion = ref<TemplateVersion | null>(null)
  const versions = ref<TemplateVersion[]>([])
  const consolidatedSheets = ref<ConsolidatedSheet[]>([])

  async function fetchTemplates() {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) throw error
    templates.value = data
  }

  async function fetchTemplate(id: string) {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    currentTemplate.value = data

    const { data: versionData, error: versionError } = await supabase
      .from('template_versions')
      .select('*')
      .eq('template_id', id)
      .order('version_number', { ascending: false })
    if (versionError) throw versionError
    versions.value = versionData
    currentVersion.value = versionData[0] ?? null
  }

  async function createTemplate(name: string, description: string): Promise<Template> {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('templates')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({ name, description, created_by: user?.id, status: 'draft' } as any)
      .select()
      .single()
    if (error) throw error
    templates.value.unshift(data)
    currentTemplate.value = data
    return data
  }

  async function saveVersion(templateId: string, schemaJson: SchemaJson): Promise<TemplateVersion> {
    const { data: { user } } = await supabase.auth.getUser()
    const nextVersion = (versions.value[0]?.version_number ?? 0) + 1
    const { data, error } = await supabase
      .from('template_versions')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({
        template_id: templateId,
        version_number: nextVersion,
        schema_json: schemaJson as unknown as import('@/types/database').Json,
        created_by: user?.id,
      } as any)
      .select()
      .single()
    if (error) throw error

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('templates')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', templateId)

    versions.value.unshift(data)
    currentVersion.value = data
    return data
  }

  async function publishTemplate(templateId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('templates')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', templateId)
    if (error) throw error
    if (currentTemplate.value?.id === templateId) {
      currentTemplate.value.status = 'active'
    }
    const t = templates.value.find((t) => t.id === templateId)
    if (t) t.status = 'active'
  }

  async function deprecateTemplate(templateId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('templates')
      .update({ status: 'deprecated', updated_at: new Date().toISOString() })
      .eq('id', templateId)
    if (error) throw error
    const t = templates.value.find((t) => t.id === templateId)
    if (t) t.status = 'deprecated'
    if (currentTemplate.value?.id === templateId) {
      currentTemplate.value.status = 'deprecated'
    }
  }

  async function fetchConsolidatedSheets(templateId: string) {
    const { data, error } = await supabase
      .from('consolidated_sheets')
      .select('*')
      .eq('template_id', templateId)
      .order('generated_at', { ascending: false })
    if (error) throw error
    consolidatedSheets.value = data
  }

  async function getDownloadUrl(filePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from('consolidated')
      .createSignedUrl(filePath, 3600)
    if (error) throw error
    return data.signedUrl
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
