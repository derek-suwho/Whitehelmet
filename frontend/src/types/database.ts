// Plain TypeScript types — no Supabase dependency

export interface Organization {
  id: string
  name: string
  type: 'pif' | 'devco'
  parent_org_id: string | null
  created_at: string
}

export interface Profile {
  id: string
  org_id: string | null
  role: 'pif_admin' | 'devco_admin' | 'devco_user'
  display_name: string
  created_at: string
}

export interface Template {
  id: string
  name: string
  description: string | null
  created_by: string | null
  status: 'draft' | 'active' | 'deprecated'
  created_at: string
  updated_at: string
}

export interface TemplateVersion {
  id: string
  template_id: string
  version_number: number
  schema_json: SchemaJson
  created_by: string | null
  created_at: string
}

export interface TemplateAssignment {
  id: string
  template_version_id: string | null
  org_id: string
  assigned_by: string | null
  deadline: string | null
  submission_type: 'template' | 'freeform'
  instructions: string | null
  status: 'pending' | 'submitted' | 'locked'
  upload_token: string | null
  upload_token_expires_at: string | null
  assigned_at: string
}

export interface Submission {
  id: string
  assignment_id: string
  org_id: string
  file_path: string
  file_name: string
  status: 'submitted' | 'locked'
  submitted_at: string
  submitted_by: string | null
}

export interface ConsolidatedSheet {
  id: string
  template_id: string
  file_path: string
  generated_by: string | null
  generated_at: string
}

export interface SchemaColumn {
  id: string
  name: string
  type: 'text' | 'number' | 'date' | 'percentage'
  description?: string
  formula_id?: string
  validation?: {
    required?: boolean
    min?: number
    max?: number
    options?: string[]
  }
}

export interface SchemaJson {
  columns: SchemaColumn[]
}
