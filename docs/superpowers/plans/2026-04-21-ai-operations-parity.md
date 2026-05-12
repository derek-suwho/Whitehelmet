# AI Operations Parity — Vue Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port all 20+ AI spreadsheet operations from the legacy MVP (`js/ai-operations.js`) into the Vue 3 production frontend (`frontend/src/composables/useAiOperations.ts`), fixing the existing backend/frontend contract mismatch in the process.

**Architecture:** The `/api/ai/command` backend endpoint is the parse layer — it receives a user message + spreadsheet snapshot and returns a structured `{op, params}`. The frontend `applyOperation()` switch executes the op against the Jspreadsheet CE instance. Three complex multi-step ops (`suggest_template`, `consolidate_to_template`, `dynamic_report`) bypass the command endpoint and run multi-call AI flows client-side, exactly like the legacy.

**Tech Stack:** FastAPI + Pydantic (backend), Vue 3 + TypeScript + Pinia + Jspreadsheet CE + SheetJS/XLSX (frontend), `/api/ai/chat` OpenRouter proxy for multi-step ops.

---

## Chunk 1: Backend — Fix Contract + Expand Op Set

### Task 1: Fix `CommandRequest` / `CommandResponse` schemas

**Files:**
- Modify: `backend/app/schemas/ai.py`

Current `CommandRequest` uses `user_text` / `column_headers` but frontend sends `message` / `headers`. `CommandResponse` returns `{op, raw}` but should return `{op, params}`.

- [ ] **Step 1: Edit the schemas**

```python
# backend/app/schemas/ai.py
"""AI proxy request/response schemas."""

from pydantic import BaseModel


class ChatRequest(BaseModel):
    messages: list[dict]
    model: str = "anthropic/claude-opus-4-5"
    max_tokens: int = 4096
    stream: bool = True


class ConsolidateRequest(BaseModel):
    files_data: list[dict]  # [{name, headers, rows}]
    model: str = "anthropic/claude-opus-4-5"


class CommandRequest(BaseModel):
    message: str
    headers: list[str]
    snapshot: str | None = None   # TSV snapshot of current grid (up to 100 rows)
    model: str = "anthropic/claude-opus-4-5"


class CommandResponse(BaseModel):
    op: str | None
    params: dict = {}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/ai.py
git commit -m "fix: align CommandRequest/Response schema with frontend"
```

---

### Task 2: Fix `/api/ai/command` endpoint — use new schema + expand system prompt

**Files:**
- Modify: `backend/app/api/routes/ai.py`

The system prompt only covers 6 ops. Expand to all 17 ops the frontend will handle. Include snapshot in the AI context.

- [ ] **Step 1: Replace the `/command` route**

```python
# Replace the @router.post("/command", ...) function with:

COMMAND_SYSTEM_PROMPT = """\
You are a spreadsheet command parser. Given a user message and the current \
spreadsheet state, return ONLY a JSON object (no markdown, no extra text).

Supported operations (return exactly one):
{"op":"add_column","name":"<header>","position":<0-based index or null for end>}
{"op":"remove_column","name":"<header>"}
{"op":"rename_column","from":"<old>","to":"<new>"}
{"op":"apply_formula","column":"<header>","formula":"<e.g. =A{row}+B{row}>"}
{"op":"sort","column":"<header>","order":"asc|desc"}
{"op":"filter","column":"<header>","operator":">|<|>=|<=|=|!=|contains","value":"<val>"}
{"op":"show_all_rows"}
{"op":"remove_empty_rows"}
{"op":"aggregate","column":"<header>","func":"sum|average|count|min|max"}
{"op":"find_duplicates","column":"<header>"}
{"op":"add_row","count":<number>,"position":<0-based or null for end>}
{"op":"format_cells","column":"<header or null>","row":<1-based or null>,"props":{"bold":true,"italic":true,"color":"#hex","bgColor":"#hex","align":"left|center|right"}}
{"op":"highlight_column","column":"<header>","bgColor":"#hex"}
{"op":"conditional_format","column":"<header>","operator":">|<|>=|<=|=|!=|contains","value":"<val>","props":{"bgColor":"#hex","color":"#hex","bold":true}}
{"op":"clear_format","column":"<header or null>"}
{"op":"export"}
{"op":"save_record"}
{"op":"show_dashboard"}
{"op":null}

Notes:
- filter: hide rows where column does NOT match the condition.
- show_all_rows: triggered by "show all", "clear filter", "unfilter".
- aggregate: report sum/avg/count/min/max in chat, no grid change.
- find_duplicates: report duplicate values in chat, no grid change.
- export: download spreadsheet as xlsx.
- save_record: save current grid to master records.
- show_dashboard: navigate to master records dashboard.
- format_cells: column=null means whole sheet; row=null means all data rows.
- If NOT a spreadsheet command return {"op":null}.
"""


@router.post("/command", response_model=CommandResponse)
async def command(body: CommandRequest):
    """Parse NL spreadsheet command via OpenRouter."""
    context_parts = []
    if body.snapshot:
        context_parts.append(body.snapshot)
    else:
        context_parts.append(f"Column headers: {json.dumps(body.headers)}")
    context_parts.append(f"User command: {body.message}")

    data = await _openrouter_post({
        "model": body.model,
        "max_tokens": 512,
        "messages": [
            {"role": "system", "content": COMMAND_SYSTEM_PROMPT},
            {"role": "user", "content": "\n\n".join(context_parts)},
        ],
    })
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
    try:
        parsed = json.loads(content.strip())
    except json.JSONDecodeError:
        parsed = {"op": None}

    op = parsed.pop("op", None)
    return CommandResponse(op=op, params=parsed)
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/routes/ai.py
git commit -m "feat: expand /command system prompt to 17 ops + include snapshot context"
```

---

## Chunk 2: Frontend — Types + Contract Fix

### Task 3: Update TypeScript types

**Files:**
- Modify: `frontend/src/types/index.ts`

`AiOperationType` only has 5 values. `AiCommandResponse` shape doesn't match what the backend returns. Fix both.

- [ ] **Step 1: Update types**

Replace the AI-related types:

```typescript
// Remove AiCommandResponse and AiOperation entirely.
// Replace with:

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
```

The full updated `types/index.ts`:

```typescript
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

export interface ApiResponse<T = unknown> {
  data: T
  message?: string
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat: expand AiOperationType to 17 ops, fix CommandApiResponse shape"
```

---

## Chunk 3: Frontend — Full Operation Implementation

### Task 4: Rewrite `useAiOperations.ts`

**Files:**
- Modify: `frontend/src/composables/useAiOperations.ts`

This is the main task. Implements all ops, fixes the request/response contract, adds snapshot, adds multi-step AI flows, and adds the user message to chat.

Key design notes:
- `useRouter()` must be called synchronously during `useAiOperations()` (not inside async `handleCommand`) because Vue's `inject()` only works in setup context.
- Three ops bypass `/api/ai/command` and run multi-step AI flows: `suggest_template`, `consolidate_to_template`, `dynamic_report`. These are keyword-matched first, before sending to the command endpoint.
- Formatting uses Jspreadsheet CE's `jss.setStyle({ cellName: styleString })` API.
- Row filtering is CSS-based (`tr.style.display = 'none'`) since Jspreadsheet CE has no native hide-row API.
- A module-level `hiddenRows` Set tracks which rows are hidden so `show_all_rows` can restore them.
- `save_record` calls `useRecordsStore().createRecord()`.
- `show_dashboard` uses the captured router to navigate to `/dashboard`.

- [ ] **Step 1: Write the full composable**

```typescript
import * as XLSX from 'xlsx'
import { useRouter } from 'vue-router'
import { api } from '@/composables/useApi'
import { useSpreadsheetStore } from '@/stores/spreadsheet'
import { useSourcesStore } from '@/stores/sources'
import { useRecordsStore } from '@/stores/records'
import { useChatStore } from '@/stores/chat'
import type { CommandApiResponse } from '@/types'

// ── Module-level filter state ────────────────────────────────────────────────
// Tracks which rows are CSS-hidden by the filter op so show_all_rows can restore them.
const hiddenRows = new Set<number>()

// ── Helpers ──────────────────────────────────────────────────────────────────

function getColumnHeaders(jss: any): string[] {
  const config = jss.getConfig?.() ?? jss.options ?? {}
  const columns = config.columns ?? []
  if (columns.length > 0) {
    return columns.map((c: any) => String(c.title ?? c.name ?? ''))
  }
  // Fallback: read first row of data
  const data = jss.getData?.() ?? []
  if (data.length > 0) return (data[0] as unknown[]).map((c) => String(c ?? ''))
  return []
}

function getDataRows(jss: any): unknown[][] {
  return jss.getData?.() ?? []
}

function getRowCount(jss: any): number {
  return (jss.getData?.() ?? []).length
}

function getColCount(jss: any): number {
  const data = jss.getData?.() ?? []
  return data.length > 0 ? (data[0] as unknown[]).length : 0
}

function resolveColumnIndex(headers: string[], column: string | number): number {
  if (typeof column === 'number') return column
  const lower = column.toLowerCase()
  return headers.findIndex((h) => h.toLowerCase() === lower)
}

/** Column index → spreadsheet letter (0→A, 1→B, ..., 25→Z) */
function colLetter(idx: number): string {
  return String.fromCharCode(65 + idx)
}

/** 0-based col + 0-based row → cell name like "B3" */
function cellName(col: number, row: number): string {
  return `${colLetter(col)}${row + 1}`
}

/** Build a CSS style string from op props */
function buildStyle(props: Record<string, unknown>): string {
  const styles: string[] = []
  if (props.bold) styles.push('font-weight: bold')
  if (props.italic) styles.push('font-style: italic')
  if (props.color) styles.push(`color: ${props.color}`)
  if (props.bgColor) styles.push(`background-color: ${props.bgColor}`)
  if (props.align) styles.push(`text-align: ${props.align}`)
  return styles.join('; ')
}

function evaluateCondition(
  cellVal: unknown,
  operator: string,
  value: string,
): boolean {
  const numCell = parseFloat(String(cellVal))
  const numVal = parseFloat(value)
  const bothNumeric = !isNaN(numCell) && !isNaN(numVal)
  switch (operator) {
    case '>': return bothNumeric && numCell > numVal
    case '<': return bothNumeric && numCell < numVal
    case '>=': return bothNumeric && numCell >= numVal
    case '<=': return bothNumeric && numCell <= numVal
    case '=': return String(cellVal) === value
    case '!=': return String(cellVal) !== value
    case 'contains': return String(cellVal).toLowerCase().includes(value.toLowerCase())
    default: return false
  }
}

/** Generate a TSV snapshot of the current grid (headers + up to 100 rows) */
function buildSnapshot(jss: any): string {
  const headers = getColumnHeaders(jss)
  const data = getDataRows(jss)
  const cap = 100
  const rows = data.slice(0, cap)
  const truncated = data.length > cap
  const lines: string[] = [
    `Spreadsheet (${data.length} row${data.length !== 1 ? 's' : ''}${truncated ? `, showing first ${cap}` : ''}):`,
    headers.join('\t'),
  ]
  for (const row of rows) {
    lines.push(
      (row as unknown[])
        .map((c) => String(c ?? '').slice(0, 80))
        .join('\t'),
    )
  }
  return lines.join('\n')
}

/** Parse selected source XLSX files into a readable text snapshot */
async function buildSourceSnapshot(): Promise<string | null> {
  const sources = useSourcesStore()
  const files = sources.getCheckedFiles()
  if (!files.length) return null

  const infos = await Promise.all(
    files.map(async (file) => {
      try {
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
        const headers = ((aoa[0] ?? []) as unknown[])
          .map(String)
          .filter((h) => h.trim())
        const sampleRows = aoa.slice(1, 6) // up to 5 sample rows
        return { name: file.name, headers, sampleRows }
      } catch {
        return { name: file.name, headers: [], sampleRows: [] }
      }
    }),
  )

  const lines = [`Selected sources (${infos.length}):`]
  for (const info of infos) {
    lines.push(`\nFile: ${info.name}`)
    if (!info.headers.length) { lines.push('  (no headers found)'); continue }
    lines.push(`  Columns: ${info.headers.join(', ')}`)
    if (info.sampleRows.length) {
      lines.push('  Sample:')
      for (const row of info.sampleRows) {
        const cells = info.headers.map(
          (h, i) => `${h}: ${String((row as unknown[])[i] ?? '').slice(0, 60)}`,
        )
        lines.push(`    { ${cells.join(', ')} }`)
      }
    }
  }
  return lines.join('\n')
}

/** Detect table orientation and header row/col */
async function detectLayout(aoa: unknown[][]): Promise<{
  orientation: 'vertical' | 'horizontal'
  headerRow?: number
  dataStartRow?: number
  headerCol?: number
  dataStartCol?: number
}> {
  const sample = aoa
    .slice(0, 15)
    .map((row) =>
      (row as unknown[])
        .slice(0, 15)
        .map((c) => String(c ?? ''))
        .join('\t'),
    )
    .join('\n')

  const resp = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'anthropic/claude-opus-4-5',
      max_tokens: 64,
      stream: false,
      messages: [
        { role: 'system', content: 'Return ONLY JSON describing table layout. No markdown.' },
        {
          role: 'user',
          content:
            `Grid sample (TSV):\n${sample}\n\nReturn: ` +
            `{"orientation":"vertical","header_row":<0-based>,"data_start_row":<0-based>} ` +
            `or {"orientation":"horizontal","header_col":<0-based>,"data_start_col":<0-based>}`,
        },
      ],
    }),
  })
  const json = await resp.json()
  const text: string = json.choices[0].message.content
    .trim()
    .replace(/^```[\w]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim()
  const parsed = JSON.parse(text)
  return {
    orientation: parsed.orientation,
    headerRow: parsed.header_row,
    dataStartRow: parsed.data_start_row,
    headerCol: parsed.header_col,
    dataStartCol: parsed.data_start_col,
  }
}

/** Map template columns to source columns via AI */
async function mapColumns(
  templateCols: string[],
  sourceCols: string[],
): Promise<Record<string, string | null>> {
  const resp = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'anthropic/claude-opus-4-5',
      max_tokens: 256,
      stream: false,
      messages: [
        {
          role: 'system',
          content:
            'Return ONLY a JSON object. Keys are template column names, values are best-matching source column name or null.',
        },
        {
          role: 'user',
          content: `Template columns: ${JSON.stringify(templateCols)}\nSource columns: ${JSON.stringify(sourceCols)}`,
        },
      ],
    }),
  })
  const json = await resp.json()
  const text: string = json.choices[0].message.content
    .trim()
    .replace(/^```[\w]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim()
  return JSON.parse(text)
}

/** Parse a source XLSX file into headers + data rows, respecting layout */
async function parseSourceFile(file: File): Promise<{
  headers: string[]
  dataRows: unknown[][]
}> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: '',
    blankrows: false,
  })

  const layout = await detectLayout(aoa as unknown[][])

  let headers: string[]
  let dataRows: unknown[][]

  if (layout.orientation === 'horizontal') {
    const hCol = layout.headerCol ?? 0
    const dCol = layout.dataStartCol ?? 1
    headers = aoa.map((row) => String((row as unknown[])[hCol] ?? ''))
    const raw = aoa.map((row) => (row as unknown[]).slice(dCol))
    dataRows =
      raw.length && raw[0].length
        ? raw[0].map((_, ci) => raw.map((row) => row[ci] ?? ''))
        : []
  } else {
    const hRow = layout.headerRow ?? 0
    const dRow = layout.dataStartRow ?? 1
    headers = ((aoa[hRow] ?? []) as unknown[]).map((h) => String(h ?? ''))
    dataRows = aoa.slice(dRow) as unknown[][]
  }

  return { headers, dataRows }
}

// ── Keyword matchers for multi-step ops ──────────────────────────────────────

const SUGGEST_RE =
  /suggest.*(template|column)|what column|recommend.*column/i
const CONSOLIDATE_RE =
  /fill.*(template|from source)|populate.*template|consolidate.*into.*template|map.*source.*template|fill it/i
const DYNAMIC_RE =
  /create.*report|build.*report|make.*report|generate.*report|create.*tracker|analyze.*source|give.*analysis/i
const NEW_TEMPLATE_RE =
  /new\s+template|create\s+(a\s+)?template|blank\s+sheet|start\s+(a\s+)?fresh/i

// ── Multi-step op implementations ────────────────────────────────────────────

async function executeSuggestTemplate(jss: any, chat: ReturnType<typeof useChatStore>): Promise<void> {
  chat.addMessage('Analyzing columns and source files…', 'ai')
  const snapshot = buildSnapshot(jss)
  const sourceSnap = await buildSourceSnapshot()

  let userContent = ''
  if (sourceSnap) userContent += sourceSnap + '\n\n'
  userContent += `Current columns: ${JSON.stringify(getColumnHeaders(jss))}`
  if (snapshot) userContent += `\n\nGrid sample:\n${snapshot.split('\n').slice(0, 6).join('\n')}`
  userContent +=
    '\n\nRecommend a standard column schema. Format as:\n**Keep:** [...]\n**Rename:** [old → new]\n**Add:** [...]\n**Remove:** [...]'

  const resp = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'anthropic/claude-opus-4-5',
      max_tokens: 1024,
      stream: false,
      messages: [
        {
          role: 'system',
          content:
            'You are a QHSE project management expert. Analyze spreadsheet columns and recommend a standardized master record schema. Be concise and actionable.',
        },
        { role: 'user', content: userContent },
      ],
    }),
  })
  const json = await resp.json()
  const result: string = json.choices[0].message.content
  // Update last AI message
  const msgs = chat.messages
  const lastAi = [...msgs].reverse().find((m) => m.role === 'ai')
  if (lastAi) lastAi.content = result
}

async function executeConsolidateToTemplate(
  jss: any,
  chat: ReturnType<typeof useChatStore>,
  userText: string,
): Promise<void> {
  const sources = useSourcesStore()
  const files = sources.getCheckedFiles()
  if (!files.length) {
    chat.addMessage('No source files selected. Check boxes in the left panel.', 'system')
    return
  }

  let templateHeaders = getColumnHeaders(jss).filter((h) => h.trim())

  // If no template headers, auto-generate from source files
  if (!templateHeaders.length) {
    chat.addMessage('Generating template headers from source files…', 'ai')
    const sourceSnap = await buildSourceSnapshot()
    const hResp = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'anthropic/claude-opus-4-5',
        max_tokens: 256,
        stream: false,
        messages: [
          {
            role: 'system',
            content:
              'You are a QHSE expert. Return ONLY a JSON array of column header strings — no other text, no markdown.',
          },
          {
            role: 'user',
            content:
              (sourceSnap ?? '') +
              `\n\nUser request: ${userText}\n\nDesign a master template column list (8-14 columns) tailored to this request.`,
          },
        ],
      }),
    })
    const hJson = await hResp.json()
    const hText: string = hJson.choices[0].message.content
      .trim()
      .replace(/^```[\w]*\n?/, '')
      .replace(/\n?```$/, '')
      .trim()
    templateHeaders = JSON.parse(hText)
    // Write headers into row 0
    for (let i = 0; i < templateHeaders.length; i++) {
      jss.setValueFromCoords(i, 0, templateHeaders[i])
    }
  }

  const outputRows: unknown[][] = []
  const n = files.length

  for (let i = 0; i < n; i++) {
    const file = files[i]
    // Update progress
    const msgs = chat.messages
    const lastAi = [...msgs].reverse().find((m) => m.role === 'ai')
    if (lastAi) lastAi.content = `Mapping file ${i + 1} of ${n}: ${file.name}…`

    const { headers: srcHeaders, dataRows: srcData } = await parseSourceFile(file)
    const mapping = await mapColumns(templateHeaders, srcHeaders)

    for (const row of srcData) {
      const isEmpty = (row as unknown[]).every(
        (c) => c === '' || c === null || c === undefined,
      )
      if (isEmpty) continue
      const mapped = templateHeaders.map((col) => {
        const srcCol = mapping[col]
        if (!srcCol) return ''
        const idx = srcHeaders.indexOf(srcCol)
        return idx >= 0 ? (row as unknown[])[idx] ?? '' : ''
      })
      outputRows.push(mapped)
    }
  }

  const finalData = [templateHeaders, ...outputRows]
  jss.loadData(finalData as any)

  const lastAi = [...chat.messages].reverse().find((m) => m.role === 'ai')
  if (lastAi)
    lastAi.content = `Filled template with ${outputRows.length} row(s) from ${n} file(s).`
}

async function executeDynamicReport(
  jss: any,
  chat: ReturnType<typeof useChatStore>,
  userText: string,
): Promise<void> {
  chat.addMessage('Planning report structure…', 'ai')
  const sourceSnap = await buildSourceSnapshot()

  const planResp = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'anthropic/claude-opus-4-5',
      max_tokens: 1024,
      stream: false,
      messages: [
        {
          role: 'system',
          content:
            'You are a QHSE data analyst. Return ONLY JSON: {"title":"...","columns":[{"name":"...","source_field":"<exact source col or null>","type":"text|number|date|currency|percent"}]}. Design 6-16 columns specific to the request.',
        },
        {
          role: 'user',
          content: (sourceSnap ? sourceSnap + '\n\n' : '') + 'User request: ' + userText,
        },
      ],
    }),
  })
  const planJson = await planResp.json()
  const planText: string = planJson.choices[0].message.content
    .trim()
    .replace(/^```[\w]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim()
  const plan = JSON.parse(planText) as {
    title: string
    columns: { name: string; source_field: string | null }[]
  }
  const templateHeaders = plan.columns.map((c) => c.name)

  if (!templateHeaders.length) {
    const lastAi = [...chat.messages].reverse().find((m) => m.role === 'ai')
    if (lastAi)
      lastAi.content = 'Could not design report columns. Try a more specific request.'
    return
  }

  // Write headers
  for (let i = 0; i < templateHeaders.length; i++) {
    jss.setValueFromCoords(i, 0, templateHeaders[i])
  }

  const sources = useSourcesStore()
  const files = sources.getCheckedFiles()
  if (!files.length) {
    const lastAi = [...chat.messages].reverse().find((m) => m.role === 'ai')
    if (lastAi)
      lastAi.content = `"${plan.title}" headers set (${templateHeaders.length} columns). Select source files and run again to fill data.`
    return
  }

  const templateColsWithHints = plan.columns.map(
    (c) => c.name + (c.source_field ? ` [hint: "${c.source_field}"]` : ''),
  )
  const outputRows: unknown[][] = []
  const n = files.length

  for (let i = 0; i < n; i++) {
    const file = files[i]
    const lastAi = [...chat.messages].reverse().find((m) => m.role === 'ai')
    if (lastAi) lastAi.content = `Building report — file ${i + 1} of ${n}: ${file.name}…`

    const { headers: srcHeaders, dataRows: srcData } = await parseSourceFile(file)
    const mapping = await mapColumns(templateColsWithHints, srcHeaders)

    for (const row of srcData) {
      const isEmpty = (row as unknown[]).every(
        (c) => c === '' || c === null || c === undefined,
      )
      if (isEmpty) continue
      const mapped = templateHeaders.map((col) => {
        const srcCol = mapping[col]
        if (!srcCol) return ''
        const idx = srcHeaders.indexOf(srcCol)
        return idx >= 0 ? (row as unknown[])[idx] ?? '' : ''
      })
      outputRows.push(mapped)
    }
  }

  jss.loadData([templateHeaders, ...outputRows] as any)
  const lastAi = [...chat.messages].reverse().find((m) => m.role === 'ai')
  if (lastAi)
    lastAi.content = `"${plan.title}" built with ${outputRows.length} row(s) from ${n} file(s).`
}

// ── Op executor ──────────────────────────────────────────────────────────────

async function applyOperation(
  jss: any,
  op: string,
  p: Record<string, unknown>,
  chat: ReturnType<typeof useChatStore>,
  router: ReturnType<typeof useRouter>,
): Promise<string> {
  const headers = getColumnHeaders(jss)

  function resolveCol(col: unknown): number {
    return resolveColumnIndex(headers, col as string | number)
  }

  switch (op) {
    // ── Column ops ──
    case 'add_column': {
      const pos = p.position != null ? Number(p.position) : getColCount(jss)
      const title = String(p.name ?? 'New Column')
      jss.insertColumn(1, pos, true)
      jss.setHeader(pos, title)
      if (p.default_value) {
        for (let r = 0; r < getRowCount(jss); r++) {
          jss.setValueFromCoords(pos, r, p.default_value as string)
        }
      }
      return `Added column "${title}".`
    }

    case 'remove_column': {
      const idx = resolveCol(p.name)
      if (idx === -1) return `Column "${p.name}" not found.`
      jss.deleteColumn(idx, 1)
      return `Removed column "${p.name}".`
    }

    case 'rename_column': {
      const idx = resolveCol(p.from)
      if (idx === -1) return `Column "${p.from}" not found.`
      jss.setHeader(idx, String(p.to ?? ''))
      return `Renamed "${p.from}" → "${p.to}".`
    }

    case 'apply_formula': {
      const idx = resolveCol(p.column)
      if (idx === -1) return `Column "${p.column}" not found.`
      const formula = String(p.formula ?? '')
      const rowCount = getRowCount(jss)
      for (let r = 0; r < rowCount; r++) {
        const resolved = formula.replace(/\{row\}/gi, String(r + 1))
        jss.setValueFromCoords(idx, r, resolved)
      }
      return `Applied formula to "${p.column}" (${rowCount} rows).`
    }

    // ── Row ops ──
    case 'sort': {
      const idx = resolveCol(p.column)
      if (idx === -1) return `Column "${p.column}" not found.`
      const asc = String(p.order ?? 'asc') === 'asc'
      jss.orderBy(idx, asc ? 0 : 1)
      return `Sorted by "${p.column}" (${asc ? 'ascending' : 'descending'}).`
    }

    case 'filter': {
      const colIdx = resolveCol(p.column)
      if (colIdx === -1) return `Column "${p.column}" not found.`
      const data = getDataRows(jss)
      const operator = String(p.operator ?? '=')
      const value = String(p.value ?? '')
      const tbody = jss.el?.querySelector('table tbody') as HTMLElement | null
      const trs = tbody?.querySelectorAll('tr')
      let hidden = 0
      for (let r = 0; r < data.length; r++) {
        const cellVal = (data[r] as unknown[])[colIdx]
        const keep = evaluateCondition(cellVal, operator, value)
        if (!keep) {
          if (trs && trs[r]) (trs[r] as HTMLElement).style.display = 'none'
          hiddenRows.add(r)
          hidden++
        }
      }
      return `Filtered: hiding ${hidden} rows where "${p.column}" ${operator} ${value}.`
    }

    case 'show_all_rows': {
      const tbody = jss.el?.querySelector('table tbody') as HTMLElement | null
      tbody?.querySelectorAll('tr').forEach((tr) => {
        ;(tr as HTMLElement).style.display = ''
      })
      hiddenRows.clear()
      return 'Showing all rows — filter cleared.'
    }

    case 'add_row': {
      const count = Number(p.count ?? 1)
      const pos = p.position != null ? Number(p.position) : getRowCount(jss)
      jss.insertRow(count, pos)
      return `Inserted ${count} row(s).`
    }

    case 'remove_empty_rows': {
      const data = getDataRows(jss)
      let deleted = 0
      // Traverse backwards to keep indices stable
      for (let r = data.length - 1; r >= 0; r--) {
        const isEmpty = (data[r] as unknown[]).every(
          (c) => c === '' || c === null || c === undefined,
        )
        if (isEmpty) {
          jss.deleteRow(r, 1)
          deleted++
        }
      }
      return `Removed ${deleted} empty row(s).`
    }

    // ── Aggregation / analysis (report in chat, no grid change) ──
    case 'aggregate': {
      const colIdx = resolveCol(p.column)
      if (colIdx === -1) return `Column "${p.column}" not found.`
      const data = getDataRows(jss)
      const values = data
        .map((row) => parseFloat(String((row as unknown[])[colIdx] ?? '')))
        .filter((v) => !isNaN(v))
      const func = String(p.func ?? 'sum')
      if (!values.length) return `No numeric values found in "${p.column}".`
      let result: number
      switch (func) {
        case 'sum': result = values.reduce((a, b) => a + b, 0); break
        case 'average': result = values.reduce((a, b) => a + b, 0) / values.length; break
        case 'count': return `Count of numeric values in "${p.column}": ${values.length}`
        case 'min': result = Math.min(...values); break
        case 'max': result = Math.max(...values); break
        default: return `Unknown function "${func}".`
      }
      return `${func.charAt(0).toUpperCase() + func.slice(1)} of "${p.column}": ${func === 'average' ? result.toFixed(2) : result}`
    }

    case 'find_duplicates': {
      const colIdx = resolveCol(p.column)
      if (colIdx === -1) return `Column "${p.column}" not found.`
      const data = getDataRows(jss)
      const seen: Record<string, number[]> = {}
      for (let r = 0; r < data.length; r++) {
        const val = String((data[r] as unknown[])[colIdx] ?? '').trim()
        if (!val) continue
        ;(seen[val] ??= []).push(r + 1)
      }
      const dupes = Object.entries(seen)
        .filter(([, rows]) => rows.length > 1)
        .map(([val, rows]) => `"${val}" (rows ${rows.join(', ')})`)
      if (!dupes.length) return `No duplicates found in "${p.column}".`
      return `Duplicates in "${p.column}":\n${dupes.join('\n')}`
    }

    // ── Formatting ──
    case 'format_cells': {
      const props = (p.props ?? {}) as Record<string, unknown>
      const style = buildStyle(props)
      if (!style) return 'No formatting properties specified.'

      const colIdx = p.column != null ? resolveCol(p.column) : null
      const targetRow = p.row != null ? Number(p.row) - 1 : null // convert 1-based → 0-based
      const data = getDataRows(jss)

      const styleMap: Record<string, string> = {}
      const rows = targetRow != null ? [targetRow] : Array.from({ length: data.length }, (_, i) => i)
      const cols = colIdx != null ? [colIdx] : Array.from({ length: getColCount(jss) }, (_, i) => i)

      for (const r of rows) {
        for (const c of cols) {
          styleMap[cellName(c, r)] = style
        }
      }
      jss.setStyle(styleMap)
      return `Formatted ${p.column ? `"${p.column}"` : 'selection'}.`
    }

    case 'highlight_column': {
      const colIdx = resolveCol(p.column)
      if (colIdx === -1) return `Column "${p.column}" not found.`
      const data = getDataRows(jss)
      const style = `background-color: ${p.bgColor}`
      const styleMap: Record<string, string> = {}
      for (let r = 0; r < data.length; r++) {
        styleMap[cellName(colIdx, r)] = style
      }
      jss.setStyle(styleMap)
      return `Highlighted "${p.column}" with ${p.bgColor}.`
    }

    case 'conditional_format': {
      const colIdx = resolveCol(p.column)
      if (colIdx === -1) return `Column "${p.column}" not found.`
      const data = getDataRows(jss)
      const props = (p.props ?? {}) as Record<string, unknown>
      const style = buildStyle(props)
      const operator = String(p.operator ?? '=')
      const value = String(p.value ?? '')
      const styleMap: Record<string, string> = {}
      let matched = 0
      for (let r = 0; r < data.length; r++) {
        if (evaluateCondition((data[r] as unknown[])[colIdx], operator, value)) {
          for (let c = 0; c < getColCount(jss); c++) {
            styleMap[cellName(c, r)] = style
          }
          matched++
        }
      }
      jss.setStyle(styleMap)
      return `Conditional format applied to ${matched} row(s) where "${p.column}" ${operator} ${value}.`
    }

    case 'clear_format': {
      const colIdx = p.column != null ? resolveCol(p.column) : null
      const data = getDataRows(jss)
      const styleMap: Record<string, string> = {}
      const cols = colIdx != null ? [colIdx] : Array.from({ length: getColCount(jss) }, (_, i) => i)
      for (let r = 0; r < data.length; r++) {
        for (const c of cols) {
          styleMap[cellName(c, r)] = ''
        }
      }
      jss.setStyle(styleMap)
      return `Cleared formatting from ${p.column ? `"${p.column}"` : 'entire sheet'}.`
    }

    // ── Utility ──
    case 'export': {
      const spreadsheet = useSpreadsheetStore()
      const headers = getColumnHeaders(jss)
      const data = getDataRows(jss)
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
      XLSX.writeFile(wb, `${spreadsheet.fileName ?? 'export'}.xlsx`)
      return 'Downloading spreadsheet as .xlsx…'
    }

    case 'save_record': {
      const spreadsheet = useSpreadsheetStore()
      const records = useRecordsStore()
      const headers = getColumnHeaders(jss)
      const data = getDataRows(jss)
      const date = new Date().toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
      const name = `${spreadsheet.fileName ?? 'Record'} — ${date}`
      await records.createRecord({ name, headers, rows: data as unknown[][] })
      return `Saved "${name}" to master records.`
    }

    case 'show_dashboard': {
      await router.push({ name: 'dashboard' })
      return 'Opening master records…'
    }

    default:
      return `Unknown operation: ${op}`
  }
}

// ── Composable ───────────────────────────────────────────────────────────────

export function useAiOperations() {
  // Must be called in setup context — captured here for use inside async handleCommand
  const router = useRouter()

  async function handleCommand(text: string): Promise<boolean> {
    const chat = useChatStore()
    const spreadsheet = useSpreadsheetStore()
    const jss = spreadsheet.instance

    // Always echo user message to chat
    chat.addMessage(text, 'user')

    // ── Multi-step keyword shortcuts (bypass /api/ai/command) ──
    if (NEW_TEMPLATE_RE.test(text)) {
      // Create a blank Jspreadsheet with 26 empty columns
      // (handled by the SpreadsheetEditor "New" button — just acknowledge)
      chat.addMessage('Use the "New" button in the editor panel to create a blank template.', 'ai')
      return true
    }

    if (!jss) return false

    if (SUGGEST_RE.test(text)) {
      await executeSuggestTemplate(jss, chat)
      return true
    }
    if (CONSOLIDATE_RE.test(text)) {
      await executeConsolidateToTemplate(jss, chat, text)
      return true
    }
    if (DYNAMIC_RE.test(text)) {
      await executeDynamicReport(jss, chat, text)
      return true
    }

    // ── Generic command via /api/ai/command ──
    const snapshot = buildSnapshot(jss)
    const headers = getColumnHeaders(jss)

    const resp = await api.post<CommandApiResponse>('/api/ai/command', {
      message: text,
      headers,
      snapshot,
    })

    if (!resp.op) return false

    // Add placeholder AI message (updated after op runs)
    chat.addMessage('Working…', 'ai')

    try {
      const result = await applyOperation(jss, resp.op, resp.params, chat, router)
      const lastAi = [...chat.messages].reverse().find((m) => m.role === 'ai')
      if (lastAi) lastAi.content = result
      return true
    } catch (err) {
      const lastAi = [...chat.messages].reverse().find((m) => m.role === 'ai')
      const msg = err instanceof Error ? err.message : String(err)
      if (lastAi) lastAi.content = `Error: ${msg}`
      console.error('[ai-operations]', err)
      return true
    }
  }

  return { handleCommand }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors (or only pre-existing unrelated errors).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/composables/useAiOperations.ts
git commit -m "feat: implement full AI operations parity — 17 ops + multi-step flows"
```

---

### Task 5: Fix `ChatPanel.vue` — remove duplicate user message

**Files:**
- Modify: `frontend/src/components/chat/ChatPanel.vue`

`chat.sendMessage(text)` also calls `addMessage(text, 'user')` internally. Now that `handleCommand` also adds the user message, we must remove the redundant add from `sendMessage`. But `sendMessage` is also called for non-command chat (regular AI chat), where the user message should still appear.

The cleanest fix: extract the user message echo out of `chat.sendMessage` and put it in `ChatPanel.sendMessage` instead. This way both paths (command and chat) add the user message from the panel level.

But `handleCommand` already adds the user message now. So we only need to remove it from `chat.sendMessage` and add it in the panel before calling `chat.sendMessage`.

- [ ] **Step 1: Update `chat.ts` — remove `addMessage(text, 'user')` from `sendMessage`**

In `frontend/src/stores/chat.ts`, remove this line from `sendMessage`:
```typescript
// Remove:
addMessage(text, 'user')
```

The `sendMessage` function starts with:
```typescript
async function sendMessage(text: string) {
    addMessage(text, 'user')  // ← remove this line
    ...
```

- [ ] **Step 2: Update `ChatPanel.vue` — add user message before calling `sendMessage`**

In `ChatPanel.vue`'s `sendMessage` function, after the `handleCommand` check:
```typescript
async function sendMessage() {
  const text = input.value.trim()
  if (!text || chat.isStreaming) return

  input.value = ''

  // Try AI operations first (handleCommand adds user message internally)
  const handled = await handleCommand(text)
  if (handled) return

  // Regular chat — add user message here since sendMessage no longer does it
  chat.addMessage(text, 'user')
  await chat.sendMessage(text)
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/stores/chat.ts frontend/src/components/chat/ChatPanel.vue
git commit -m "fix: centralize user message echo in ChatPanel to avoid duplication"
```

---

## Unresolved Questions

1. **Jspreadsheet CE `setStyle` exact API**: Is `jss.setStyle({ 'A1': 'color: red' })` the correct object form, or is it `jss.setStyle('A1', 'color', 'red')`? Verify against installed Jspreadsheet CE version.
2. **Jspreadsheet CE `insertRow` signature**: Is it `jss.insertRow(count, position)` or `jss.insertRow(position, count)`? Check CE docs.
3. **Filter row targeting**: Does Jspreadsheet CE's table render `<tbody>` → `<tr>` without any wrapper rows? Verify DOM structure before relying on `tbody tr` index = row index.
4. **`loadData` API**: Does `jss.loadData(aoa)` accept a 2D array where row 0 is headers, or does it expect headers separately? The legacy MVP used Handsontable's API — Jspreadsheet CE may differ.
5. **Route name for dashboard**: Is the dashboard route named `'dashboard'`? Check `frontend/src/router/index.ts`.
