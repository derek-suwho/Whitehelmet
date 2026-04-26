export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          type: 'pif' | 'devco'
          parent_org_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          type: 'pif' | 'devco'
          parent_org_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: 'pif' | 'devco'
          parent_org_id?: string | null
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          org_id: string | null
          role: 'pif_admin' | 'devco_admin' | 'devco_user'
          display_name: string
          created_at: string
        }
        Insert: {
          id: string
          org_id?: string | null
          role: 'pif_admin' | 'devco_admin' | 'devco_user'
          display_name: string
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string | null
          role?: 'pif_admin' | 'devco_admin' | 'devco_user'
          display_name?: string
          created_at?: string
        }
      }
      templates: {
        Row: {
          id: string
          name: string
          description: string | null
          created_by: string | null
          status: 'draft' | 'active' | 'deprecated'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_by?: string | null
          status?: 'draft' | 'active' | 'deprecated'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_by?: string | null
          status?: 'draft' | 'active' | 'deprecated'
          created_at?: string
          updated_at?: string
        }
      }
      template_versions: {
        Row: {
          id: string
          template_id: string
          version_number: number
          schema_json: Json
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          template_id: string
          version_number: number
          schema_json: Json
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          template_id?: string
          version_number?: number
          schema_json?: Json
          created_by?: string | null
          created_at?: string
        }
      }
      template_assignments: {
        Row: {
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
        Insert: {
          id?: string
          template_version_id?: string | null
          org_id: string
          assigned_by?: string | null
          deadline?: string | null
          submission_type?: 'template' | 'freeform'
          instructions?: string | null
          status?: 'pending' | 'submitted' | 'locked'
          upload_token?: string | null
          upload_token_expires_at?: string | null
          assigned_at?: string
        }
        Update: {
          id?: string
          template_version_id?: string | null
          org_id?: string
          assigned_by?: string | null
          deadline?: string | null
          submission_type?: 'template' | 'freeform'
          instructions?: string | null
          status?: 'pending' | 'submitted' | 'locked'
          upload_token?: string | null
          upload_token_expires_at?: string | null
          assigned_at?: string
        }
      }
      submissions: {
        Row: {
          id: string
          assignment_id: string
          org_id: string
          file_path: string
          file_name: string
          status: 'submitted' | 'locked'
          submitted_at: string
          submitted_by: string | null
        }
        Insert: {
          id?: string
          assignment_id: string
          org_id: string
          file_path: string
          file_name: string
          status?: 'submitted' | 'locked'
          submitted_at?: string
          submitted_by?: string | null
        }
        Update: {
          id?: string
          assignment_id?: string
          org_id?: string
          file_path?: string
          file_name?: string
          status?: 'submitted' | 'locked'
          submitted_at?: string
          submitted_by?: string | null
        }
      }
      formulas: {
        Row: {
          id: string
          name: string
          description: string | null
          nl_prompt: string | null
          expression: string
          formula_type: 'aggregation' | 'calculation' | 'lookup' | 'transformation'
          is_library_item: boolean
          created_by: string | null
          usage_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          nl_prompt?: string | null
          expression: string
          formula_type: 'aggregation' | 'calculation' | 'lookup' | 'transformation'
          is_library_item?: boolean
          created_by?: string | null
          usage_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          nl_prompt?: string | null
          expression?: string
          formula_type?: 'aggregation' | 'calculation' | 'lookup' | 'transformation'
          is_library_item?: boolean
          created_by?: string | null
          usage_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      consolidated_sheets: {
        Row: {
          id: string
          template_id: string
          file_path: string
          generated_by: string | null
          generated_at: string
        }
        Insert: {
          id?: string
          template_id: string
          file_path: string
          generated_by?: string | null
          generated_at?: string
        }
        Update: {
          id?: string
          template_id?: string
          file_path?: string
          generated_by?: string | null
          generated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience row types
export type Organization = Database['public']['Tables']['organizations']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Template = Database['public']['Tables']['templates']['Row']
export type TemplateVersion = Database['public']['Tables']['template_versions']['Row']
export type TemplateAssignment = Database['public']['Tables']['template_assignments']['Row']
export type Submission = Database['public']['Tables']['submissions']['Row']
export type Formula = Database['public']['Tables']['formulas']['Row']
export type ConsolidatedSheet = Database['public']['Tables']['consolidated_sheets']['Row']

// schema_json canonical structure
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
