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

export interface SavedFormula {
  id: number
  name: string
  expression: string
  parameters: string[] | null  // named param identifiers used in the expression
  description: string | null
  nl_prompt: string | null
  formula_type: string | null
  created_at: string
}

export interface FormulaCreate {
  name: string
  expression: string
  parameters?: string[]
  description?: string
  nl_prompt?: string
  formula_type?: string
}

export interface DetectedFormula {
  column: string
  expression: string
}

export type AgentEvent =
  | { type: 'tool_call'; tool: string; params: Record<string, unknown> }
  | { type: 'tool_result'; tool: string; result: string; error: boolean }
  | { type: 'message'; content: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

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
