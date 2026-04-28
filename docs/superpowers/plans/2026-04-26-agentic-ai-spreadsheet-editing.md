# Plan: Agentic AI Spreadsheet Editing

## Context

Current system: user types → AI parses NL → returns one of 18 fixed JSON ops → frontend applies. No multi-step reasoning, no data read-back, limited to hardcoded op types. User wants open-ended capability (e.g. "calculate TRIR, add status column, sort by risk" as a single command).

Solution: Replace the fixed op system with a Claude tool-use agentic loop. Claude gets tools to read and write the spreadsheet, calls them in sequence, and each tool call streams as an SSE event to the frontend which applies it to Handsontable in real-time.

**Key discovery:** `spreadsheet.instance` is a real `Handsontable` instance (not JSSpreadsheet). The existing `useAiOperations.ts` uses wrong JSSpreadsheet API (jss.setValueFromCoords, jss.insertColumn, etc.) — broken. New code uses correct Handsontable API.

**Data convention:**

- Handsontable row 0 = XLSX header row (frozen via `fixedRowsTop: 1`)
- Frontend sends: `headers = hot.getData()[0]`, `data = hot.getData().slice(1)` to backend
- Backend stores headers + data separately; `write_column`/`write_cells` use 0-based data indices
- Frontend `applyAgentTool()` adds +1 to all row indices (to skip HT header row)

---

## Files to Modify


| File                                          | Change                                                                                                            |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `backend/app/schemas/ai.py`                   | Add `AgentRequest` schema                                                                                         |
| `backend/app/api/routes/ai.py`                | Add `AGENT_TOOLS`, `SpreadsheetState`, `execute_tool()`, `/api/ai/agent` SSE endpoint; delete `/command` endpoint |
| `frontend/src/types/index.ts`                 | Add `AgentEvent` union type; remove old `AiOperationType`, `CommandApiResponse`                                   |
| `frontend/src/stores/chat.ts`                 | Add `addMutableMessage()` helper                                                                                  |
| `frontend/src/composables/useAiOperations.ts` | Full replacement: `handleAgentCommand()` + `applyAgentTool()`                                                     |
| `frontend/src/components/chat/ChatPanel.vue`  | Change `handleCommand` → `handleAgentCommand` (2 lines)                                                           |


---

## Backend Changes

### 1. `backend/app/schemas/ai.py` — Add AgentRequest

```python
class AgentRequest(BaseModel):
    message: str
    headers: list[str]
    data: list[list] = []
    model: str = "anthropic/claude-sonnet-4-6"
```

### 2. `backend/app/api/routes/ai.py` — Tool definitions (OpenAI format for OpenRouter)

```python
AGENT_TOOLS = [
    {"type": "function", "function": {
        "name": "get_spreadsheet_data",
        "description": "Re-read current spreadsheet state (headers + all data rows). Use after writes to verify results.",
        "parameters": {"type": "object", "properties": {}, "required": []}
    }},
    {"type": "function", "function": {
        "name": "add_column",
        "description": "Add a new column. position is 0-based index; null = append at end.",
        "parameters": {"type": "object", "properties": {
            "name": {"type": "string"},
            "position": {"type": ["integer", "null"]}
        }, "required": ["name"]}
    }},
    {"type": "function", "function": {
        "name": "remove_column",
        "description": "Remove column by name.",
        "parameters": {"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]}
    }},
    {"type": "function", "function": {
        "name": "rename_column",
        "description": "Rename a column.",
        "parameters": {"type": "object", "properties": {
            "old_name": {"type": "string"}, "new_name": {"type": "string"}
        }, "required": ["old_name", "new_name"]}
    }},
    {"type": "function", "function": {
        "name": "write_column",
        "description": "Write values to every data row of a column. values list length must match row count.",
        "parameters": {"type": "object", "properties": {
            "column_name": {"type": "string"},
            "values": {"type": "array", "items": {"type": ["string", "number", "null"]}}
        }, "required": ["column_name", "values"]}
    }},
    {"type": "function", "function": {
        "name": "write_cells",
        "description": "Write specific cells. row and col are 0-based data indices (excluding header row).",
        "parameters": {"type": "object", "properties": {
            "updates": {"type": "array", "items": {"type": "object", "properties": {
                "row": {"type": "integer"}, "col": {"type": "integer"}, "value": {"type": ["string", "number", "null"]}
            }, "required": ["row", "col", "value"]}}
        }, "required": ["updates"]}
    }},
    {"type": "function", "function": {
        "name": "sort",
        "description": "Sort data rows by a column.",
        "parameters": {"type": "object", "properties": {
            "column": {"type": "string"}, "order": {"type": "string", "enum": ["asc", "desc"]}
        }, "required": ["column", "order"]}
    }},
    {"type": "function", "function": {
        "name": "filter",
        "description": "Filter rows; hides non-matching rows.",
        "parameters": {"type": "object", "properties": {
            "column": {"type": "string"},
            "operator": {"type": "string", "enum": [">", "<", ">=", "<=", "=", "!=", "contains"]},
            "value": {"type": "string"}
        }, "required": ["column", "operator", "value"]}
    }},
    {"type": "function", "function": {
        "name": "show_all_rows",
        "description": "Clear active filter, show all rows.",
        "parameters": {"type": "object", "properties": {}, "required": []}
    }},
    {"type": "function", "function": {
        "name": "remove_empty_rows",
        "description": "Remove all rows where every cell is empty.",
        "parameters": {"type": "object", "properties": {}, "required": []}
    }},
    {"type": "function", "function": {
        "name": "aggregate",
        "description": "Compute sum/avg/count/min/max of a column. Returns text result — no grid change.",
        "parameters": {"type": "object", "properties": {
            "column": {"type": "string"},
            "func": {"type": "string", "enum": ["sum", "avg", "count", "min", "max"]}
        }, "required": ["column", "func"]}
    }},
]
```

### 3. `backend/app/api/routes/ai.py` — SpreadsheetState + execute_tool

```python
class SpreadsheetState:
    def __init__(self, headers: list[str], data: list[list]):
        self.headers = list(headers)
        self.data = [list(row) for row in data]

    def col_idx(self, name: str) -> int:
        lower = name.lower()
        for i, h in enumerate(self.headers):
            if h.lower() == lower:
                return i
        raise ValueError(f"Column '{name}' not found. Available: {self.headers}")

def execute_tool(state: SpreadsheetState, name: str, params: dict) -> str:
    if name == "get_spreadsheet_data":
        return f"{len(state.headers)} columns, {len(state.data)} rows. Headers: {state.headers}"
    elif name == "add_column":
        pos = params.get("position") if params.get("position") is not None else len(state.headers)
        state.headers.insert(pos, params["name"])
        for row in state.data: row.insert(pos, "")
        return f"Added column '{params['name']}' at position {pos}."
    elif name == "remove_column":
        idx = state.col_idx(params["name"])
        state.headers.pop(idx)
        for row in state.data: row.pop(idx)
        return f"Removed column '{params['name']}'."
    elif name == "rename_column":
        idx = state.col_idx(params["old_name"])
        state.headers[idx] = params["new_name"]
        return f"Renamed '{params['old_name']}' to '{params['new_name']}'."
    elif name == "write_column":
        idx = state.col_idx(params["column_name"])
        for r, v in enumerate(params["values"]):
            if r < len(state.data): state.data[r][idx] = v
        return f"Wrote {len(params['values'])} values to '{params['column_name']}'."
    elif name == "write_cells":
        for u in params["updates"]:
            r, c, v = u["row"], u["col"], u["value"]
            if 0 <= r < len(state.data) and 0 <= c < len(state.headers):
                state.data[r][c] = v
        return f"Updated {len(params['updates'])} cell(s)."
    elif name == "sort":
        idx = state.col_idx(params["column"])
        reverse = params["order"] == "desc"
        def key(row):
            v = row[idx] if idx < len(row) else ""
            try: return (0, float(str(v)))
            except: return (1, str(v).lower())
        state.data.sort(key=key, reverse=reverse)
        return f"Sorted by '{params['column']}' {params['order']}."
    elif name == "filter":
        return f"Filter spec: '{params['column']}' {params['operator']} {params['value']}."
    elif name == "show_all_rows":
        return "Filter cleared."
    elif name == "remove_empty_rows":
        before = len(state.data)
        state.data = [r for r in state.data if any(str(c).strip() for c in r)]
        return f"Removed {before - len(state.data)} empty row(s)."
    elif name == "aggregate":
        idx = state.col_idx(params["column"])
        vals = []
        for row in state.data:
            try: vals.append(float(str(row[idx] if idx < len(row) else "")))
            except: pass
        if not vals: return f"No numeric values in '{params['column']}'."
        func = params["func"]
        if func == "sum": res = sum(vals)
        elif func == "avg": res = sum(vals) / len(vals)
        elif func == "count": return f"Count: {len(vals)}"
        elif func == "min": res = min(vals)
        elif func == "max": res = max(vals)
        return f"{func}('{params['column']}') = {round(res, 4)}"
    return f"Unknown tool: {name}"
```

### 4. `backend/app/api/routes/ai.py` — `/api/ai/agent` SSE endpoint

```python
AGENT_SYSTEM_PROMPT = """\
You are an AI spreadsheet assistant with tools to read and modify spreadsheets.
- Chain multiple tool calls to complete complex tasks in one pass
- Use get_spreadsheet_data to re-read data after writes when you need to verify or compute from results
- Use write_column to fill an entire column at once; use write_cells for sparse updates
- After all tool calls, give a brief summary of what was done
- Do not exceed 20 tool calls per request
"""

@router.post("/agent")
async def agent(body: AgentRequest):
    state = SpreadsheetState(body.headers, body.data)

    async def sse_stream():
        messages = [{"role": "user", "content": (
            f"Spreadsheet: {len(state.headers)} columns, {len(state.data)} rows. "
            f"Headers: {state.headers}\n\nRequest: {body.message}"
        )}]
        tool_calls_made = 0

        try:
            while tool_calls_made < 20:
                data = await _openrouter_post({
                    "model": body.model,
                    "max_tokens": 4096,
                    "messages": [{"role": "system", "content": AGENT_SYSTEM_PROMPT}] + messages,
                    "tools": AGENT_TOOLS,
                })
                msg = data.get("choices", [{}])[0].get("message", {})
                content = msg.get("content") or ""
                tool_calls = msg.get("tool_calls") or []
                finish_reason = data.get("choices", [{}])[0].get("finish_reason", "stop")

                messages.append({"role": "assistant", "content": content, "tool_calls": tool_calls})

                if not tool_calls or finish_reason == "stop":
                    yield f"data: {json.dumps({'type': 'message', 'content': content})}\n\n"
                    break

                tool_results = []
                for tc in tool_calls:
                    tool_name = tc.get("function", {}).get("name", "")
                    try:
                        params = json.loads(tc.get("function", {}).get("arguments", "{}"))
                    except json.JSONDecodeError:
                        params = {}
                    tc_id = tc.get("id", "")

                    yield f"data: {json.dumps({'type': 'tool_call', 'tool': tool_name, 'params': params})}\n\n"

                    try:
                        result = execute_tool(state, tool_name, params)
                        error = False
                    except Exception as e:
                        result = str(e)
                        error = True

                    yield f"data: {json.dumps({'type': 'tool_result', 'tool': tool_name, 'result': result, 'error': error})}\n\n"
                    tool_results.append({"role": "tool", "tool_call_id": tc_id, "content": result})
                    tool_calls_made += 1

                messages.extend(tool_results)
            else:
                yield f"data: {json.dumps({'type': 'message', 'content': 'Reached 20 tool call limit.'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(sse_stream(), media_type="text/event-stream")
```

Also: delete `COMMAND_SYSTEM_PROMPT`, `@router.post("/command")`, and its import from schemas. Remove `CommandRequest`/`CommandResponse` from `schemas/ai.py`.

---

## Frontend Changes

### 5. `frontend/src/types/index.ts` — Add AgentEvent types, remove old types

Remove `AiOperationType` and `CommandApiResponse`. Add:

```typescript
export type AgentEvent =
  | { type: 'tool_call'; tool: string; params: Record<string, unknown> }
  | { type: 'tool_result'; tool: string; result: string; error: boolean }
  | { type: 'message'; content: string }
  | { type: 'done' }
  | { type: 'error'; message: string }
```

### 6. `frontend/src/stores/chat.ts` — Add addMutableMessage

```typescript
function addMutableMessage(text: string, role: ChatMessage['role']): ChatMessage {
  const msg: ChatMessage = { role, content: text }
  messages.value.push(msg)
  return msg  // caller mutates .content in place
}
// add to return: { ..., addMutableMessage }
```

### 7. `frontend/src/composables/useAiOperations.ts` — Full replacement

**Keep from old file:** `detectLayout`, `mapColumns`, `parseSourceFile`, `buildSourceSnapshot`, all multi-step ops (`executeSuggestTemplate`, `executeConsolidateToTemplate`, `executeDynamicReport`), all regex matchers (`SUGGEST_RE`, `CONSOLIDATE_RE`, `DYNAMIC_RE`, `NEW_TEMPLATE_RE`, `FORMULA_CREATE_RE`).

**Remove:** `getColumnHeaders`, `getDataRows`, `getRowCount`, `getColCount`, `buildSnapshot`, `applyOperation`, `handleCommand`, `hiddenRows` module-level set, all JSSpreadsheet API calls.

**Add:**

`applyAgentTool(hot, toolName, params)` — uses correct Handsontable API:

```typescript
async function applyAgentTool(hot: Handsontable, tool: string, params: Record<string, unknown>) {
  // hot.getData()[0] = header row; data rows start at index 1
  const allData = hot.getData() as unknown[][]
  const headers = allData[0] as string[]
  const colIdx = (name: string) =>
    headers.findIndex(h => String(h).toLowerCase() === String(name).toLowerCase())

  switch (tool) {
    case 'add_column': {
      const pos = params.position != null ? Number(params.position) : hot.countCols()
      if (params.position != null) {
        hot.alter('insert_col_start', pos, 1)
      } else {
        hot.alter('insert_col_end', undefined, 1)
      }
      hot.setDataAtCell(0, pos, String(params.name))  // set header row cell
      break
    }
    case 'remove_column': {
      const idx = colIdx(params.name as string)
      if (idx !== -1) hot.alter('remove_col', idx, 1)
      break
    }
    case 'rename_column': {
      const idx = colIdx(params.old_name as string)
      if (idx !== -1) hot.setDataAtCell(0, idx, String(params.new_name))
      break
    }
    case 'write_column': {
      const idx = colIdx(params.column_name as string)
      if (idx === -1) break
      const values = params.values as unknown[]
      const updates: [number, number, unknown][] = values.map((v, r) => [r + 1, idx, v])
      if (updates.length) hot.setDataAtCell(updates)
      break
    }
    case 'write_cells': {
      const updates = params.updates as { row: number; col: number; value: unknown }[]
      const htUpdates: [number, number, unknown][] = updates.map(u => [u.row + 1, u.col, u.value])
      if (htUpdates.length) hot.setDataAtCell(htUpdates)
      break
    }
    case 'sort': {
      const idx = colIdx(params.column as string)
      if (idx === -1) break
      const plugin = hot.getPlugin('columnSorting') as any
      plugin.sort({ column: idx, sortOrder: params.order as 'asc' | 'desc' })
      break
    }
    case 'filter': {
      const idx = colIdx(params.column as string)
      if (idx === -1) break
      const data = hot.getData() as unknown[][]
      const op = params.operator as string
      const val = String(params.value)
      const toHide: number[] = []
      for (let r = 1; r < data.length; r++) {
        const cell = String(data[r][idx] ?? '')
        if (!evaluateCondition(cell, op, val)) toHide.push(r)
      }
      const hiddenPlugin = hot.getPlugin('hiddenRows') as any
      hiddenPlugin.hideRows(toHide)
      hot.render()
      break
    }
    case 'show_all_rows': {
      const hiddenPlugin = hot.getPlugin('hiddenRows') as any
      const allRows = Array.from({ length: hot.countRows() }, (_, i) => i)
      hiddenPlugin.showRows(allRows)
      hot.render()
      break
    }
    case 'remove_empty_rows': {
      const data = hot.getData() as unknown[][]
      for (let r = data.length - 1; r >= 1; r--) {
        if ((data[r] as unknown[]).every(c => c === '' || c === null || c === undefined)) {
          hot.alter('remove_row', r, 1)
        }
      }
      break
    }
    // aggregate, get_spreadsheet_data — read-only, no HT mutation
  }
}
```

`handleAgentCommand(text)`:

```typescript
async function handleAgentCommand(text: string): Promise<boolean> {
  const chat = useChatStore()
  const spreadsheet = useSpreadsheetStore()
  const hot = spreadsheet.instance as Handsontable | null

  // Keyword bypass paths (same as before)
  if (NEW_TEMPLATE_RE.test(text)) { ... return true }
  if (!hot) return false
  if (SUGGEST_RE.test(text)) { await executeSuggestTemplate(hot, chat); return true }
  if (CONSOLIDATE_RE.test(text)) { await executeConsolidateToTemplate(hot, chat, text); return true }
  if (DYNAMIC_RE.test(text)) { await executeDynamicReport(hot, chat, text); return true }
  if (FORMULA_CREATE_RE.test(text)) { ... return true }

  // Build request — header row is getData()[0], data rows are slice(1)
  const allData = hot.getData() as unknown[][]
  const headers = (allData[0] ?? []) as string[]
  const data = allData.slice(1) as unknown[][]

  const progressMsg = chat.addMutableMessage('Working…', 'ai')
  chat.isStreaming = true

  try {
    const res = await fetch('/api/ai/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message: text, headers, data }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        let event: AgentEvent
        try { event = JSON.parse(line.slice(6)) } catch { continue }
        switch (event.type) {
          case 'tool_call':
            progressMsg.content = toolLabel(event.tool, event.params)
            await applyAgentTool(hot, event.tool, event.params)
            break
          case 'message':
            progressMsg.content = event.content
            break
          case 'error':
            progressMsg.content = `Error: ${event.message}`
            break
        }
      }
    }
  } catch (err) {
    progressMsg.content = `Error: ${err instanceof Error ? err.message : String(err)}`
  } finally {
    chat.isStreaming = false
  }
  return true
}
```

`toolLabel(tool, params)` — human-readable progress strings:

```typescript
function toolLabel(tool: string, params: Record<string, unknown>): string {
  const labels: Record<string, string> = {
    add_column: `Adding column "${params.name}"…`,
    remove_column: `Removing column "${params.name}"…`,
    rename_column: `Renaming "${params.old_name}" → "${params.new_name}"…`,
    write_column: `Writing "${params.column_name}"…`,
    write_cells: 'Updating cells…',
    sort: `Sorting by "${params.column}" (${params.order})…`,
    filter: `Filtering "${params.column}" ${params.operator} ${params.value}…`,
    show_all_rows: 'Clearing filter…',
    remove_empty_rows: 'Removing empty rows…',
    aggregate: `Computing ${params.func}("${params.column}")…`,
    get_spreadsheet_data: 'Reading spreadsheet…',
  }
  return labels[tool] ?? `Running ${tool}…`
}
```

Export `handleAgentCommand` from composable (remove `handleCommand`).

Also update multi-step ops to use Handsontable API instead of JSSpreadsheet API:

- Replace `jss.setValueFromCoords(i, 0, header)` → `hot.setDataAtCell(0, i, header)`
- Replace `jss.loadData([headers, ...rows])` → `hot.loadData([headers, ...rows])`

### 8. `frontend/src/components/chat/ChatPanel.vue` — 2-line change

```typescript
// Before:
const { handleCommand } = useAiOperations()
// ...
const handled = await handleCommand(text)

// After:
const { handleAgentCommand } = useAiOperations()
// ...
const handled = await handleAgentCommand(text)
```

---

## Verification

1. Open app, upload an xlsx with 5+ rows and 3+ numeric columns
2. Type: "Add a Total column that sums columns B and C for each row, then sort by Total descending" — expect: column added, values filled, sorted
3. Type: "What is the average of Total?" — expect: AI responds with the value, no grid change
4. Type: "Remove empty rows" — expect: blank rows gone
5. Type: "Filter Revenue greater than 1000" — expect: rows hidden
6. Type: "Show all rows" — expect: rows restored
7. Error case: "Sort by NonExistent column" — expect: graceful error message in chat, no crash

---

## Open Questions

1. OpenRouter tool use format: does `finish_reason: "tool_calls"` work as expected for Anthropic models through OpenRouter? (may need to test; fallback: check if `tool_calls` array is non-empty regardless of finish_reason)
2. Multi-step ops (consolidate, suggest template) currently use JSSpreadsheet API (`jss.setValueFromCoords`, `jss.loadData`) — these are also broken. Fix them as part of this task or separately?

