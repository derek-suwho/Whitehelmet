// ── Shared TypeScript interfaces ──

export interface ChatMessage {
  role: 'user' | 'ai' | 'system'
  content: string
}

export interface MasterRecord {
  id: number
  name: string
  source_count: number
  row_count: number
  col_count: number
  created_at: string
  updated_at: string
}

export interface Source {
  id: string
  name: string
  size: number
  file: File
  type: 'file' | 'folder'
  children?: Source[]
}

export type AiOperationType =
  | 'add_column'
  | 'remove_column'
  | 'rename_column'
  | 'sort'
  | 'apply_formula'
  | 'filter'
  | 'show_all_rows'
  | 'remove_empty_rows'
  | 'aggregate'
  | 'find_duplicates'
  | 'add_row'
  | 'format_cells'
  | 'highlight_column'
  | 'conditional_format'
  | 'clear_format'
  | 'export'
  | 'save_record'
  | 'show_dashboard'

export interface CommandApiResponse {
  op: AiOperationType | null
  params: Record<string, unknown>
}

export interface ConsolidationPayload {
  files_data: { name: string; headers: string[]; rows: unknown[][] }[]
}

export interface ConsolidationResponse {
  headers: string[]
  rows: unknown[][]
}

export interface UserFile {
  id: number
  original_name: string
  size_bytes: number
  sha256: string
  created_at: string
}

export interface ApiResponse<T = unknown> {
  data: T
  message?: string
}
