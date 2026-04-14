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

export interface AiOperation {
  type: AiOperationType
  params: Record<string, unknown>
}

export interface AiCommandResponse {
  handled: boolean
  operation?: AiOperation
  message?: string
}

export interface ConsolidationPayload {
  files: { name: string; headers: string[]; rows: unknown[][] }[]
}

export interface ConsolidationResponse {
  headers: string[]
  rows: unknown[][]
}

export interface ApiResponse<T = unknown> {
  data: T
  message?: string
}
