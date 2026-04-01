# Phase 1: Command Routing, Intent Parsing, and Column Operations - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire `state.chatCommandHandler` in `js/ai-operations.js`, call the Anthropic API to classify and parse natural language messages into structured operations, and apply column operations (add, remove, rename, formula) to the live Jspreadsheet CE instance. Row/data operations (sort, filter, remove-empties, aggregate) are Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Command classification
- Every message goes to Claude in a **single API call** that both classifies intent AND returns the operation object
- No local keyword pre-filter — Claude decides everything in one round-trip
- If `state.excelState.instance` is null (no spreadsheet open): return `false` silently — fall through to normal chat, no error posted

### Operation schema
- Claude returns a JSON object with shape `{ "op": "<type>", ...params }` for commands
- `op` is `null` when the message is not a spreadsheet command — handler returns `false` (falls through to normal chat)
- Column headers from the current spreadsheet are passed to Claude as context (headers only — no row data)
- Supported op types for Phase 1: `add_column`, `remove_column`, `rename_column`, `apply_formula`
- Each op carries its own params (e.g. `{ "op": "add_column", "name": "Total", "position": 2 }`)

### Thinking indicator
- When processing starts: post a temporary AI bubble with text like `"..."` or `"Thinking..."` to the chat panel via `state.addMessage`
- Replace (or remove and re-post) the bubble with the result message when Claude responds
- Do NOT lock or disable the spreadsheet grid while Claude processes
- Do NOT touch the chat badge (that is owned by `js/chat.js`)

### Error handling
- If a user references a column that does not exist (e.g. "remove column XYZ"): post an error message via `state.addMessage` and return `true` (intercept — do not fall through to normal chat)
- If Claude returns `op: null` (not a spreadsheet command): return `false` (fall through to normal chat)
- If Claude cannot parse a clear intent (ambiguous command): post a helpful error message in chat and return `true`

### Formula behavior (TMPL-04)
- "Apply a formula to a column" means: write the formula string (e.g. `=A1+B1`) as the value of each cell in that column
- Jspreadsheet CE will compute simple formulas natively; complex ones render as text
- No client-side formula evaluation — write the formula strings and let CE handle them
- Formula string is provided by Claude as a parameter in the op object

### Claude's Discretion
- Exact API prompt wording and system message content
- How to extract headers from `state.excelState.instance` (use `getHeaders()` or read the first row)
- Exact error message copy
- How to handle the "replace temp bubble" pattern (delete + re-add, or update DOM directly)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project files
- `CLAUDE.md` — File ownership, interface contracts (`state.chatCommandHandler`, `state.excelState.instance`, `state.addMessage`, `state.apiKey`), tech constraints (vanilla JS, no build step), and team boundary rules
- `.planning/REQUIREMENTS.md` — All requirement IDs for Phase 1 (ROUTE-01..03, PARSE-01..03, TMPL-01..04, UX-01..03) with acceptance criteria
- `.planning/PROJECT.md` — Core project decisions: structured ops, error-in-chat, single-command model

### Source files to read before implementing
- `js/ai-operations.js` — Target file (currently a stub); read to see the skeleton and comment conventions
- `js/chat.js` — Shows how `state.chatCommandHandler` is called, what `true`/`false` return values mean, and the existing `addMessage` DOM pattern
- `js/state.js` — Definitive interface: `state.apiKey`, `state.excelState.instance`, `state.chatCommandHandler`, `state.addMessage`, `state.conversationHistory`

### Codebase patterns
- `.planning/codebase/CONVENTIONS.md` — Use `var` (not `const`/`let`), 2-space indent, single quotes, `init*` function prefix, no JSDoc, Unicode section dividers
- `.planning/codebase/INTEGRATIONS.md` — Anthropic API headers (`anthropic-dangerous-direct-browser-access: true`, `anthropic-version: 2023-06-01`), model `claude-opus-4-5`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `state.addMessage(text, 'ai')` — Posts AI messages to the chat panel. Use this for thinking indicator, confirmations, and errors.
- `state.apiKey` — Anthropic API key string, ready to use in fetch headers
- `state.excelState.instance` — Live Jspreadsheet CE instance; use its API (`insertColumn`, `deleteColumn`, `setHeader`, `getValue`, `setValue`, etc.)
- `state.conversationHistory` — Not needed for command handler (single-command model, stateless)

### Established Patterns
- API calls: non-streaming `fetch` with JSON body (see `js/consolidation.js` for reference pattern — `stream: false`, same headers)
- Error surfacing: always via `state.addMessage(errorText, 'ai')` — never `console.log`
- Guard clauses: `if (!state.excelState.instance) return false;` before any spreadsheet access
- `var` declarations throughout — match this style
- Try/catch/finally wrapping all async paths

### Integration Points
- `js/ai-operations.js` → registers `state.chatCommandHandler` during `initAiOperations()`
- `js/chat.js` → calls `state.chatCommandHandler(text)` before its own API call; our `true` return short-circuits it
- `index.html` → loads `js/app.js` which calls `initAiOperations()` after `initChat()`; no changes to `index.html` needed

</code_context>

<specifics>
## Specific Ideas

- No specific UI references — standard chat bubble pattern used throughout the app
- The API call should be non-streaming (like `js/consolidation.js`) since we need the full JSON response before acting

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-command-routing*
*Context gathered: 2026-03-31*
