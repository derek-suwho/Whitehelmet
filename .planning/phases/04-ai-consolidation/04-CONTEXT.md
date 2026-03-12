# Phase 4: AI Consolidation - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the Anthropic Claude API to power two things: (1) AI-driven consolidation of user-selected source .xlsx files into a merged master Excel record rendered in the editor, and (2) real chat responses with in-session conversation history replacing the current mock reply. Template restructuring and data operations (AI-02, AI-03) are Phase 5.

</domain>

<decisions>
## Implementation Decisions

### Consolidation trigger
- Dedicated **Consolidate button in the sources panel header** — always visible, no context-dependent UI
- Users select files via **checkboxes on each file row** before clicking Consolidate
- If nothing is checked, show an error (don't auto-select all silently)
- Button is disabled while consolidation is in progress

### File selection
- User explicitly checks which files to include — not all-or-nothing
- Scope is controlled by what the user checks, not by what's open in the editor

### Result display
- Consolidated result **replaces whatever is currently open** in the Excel editor — one view at a time
- Editor header shows an **auto-derived name** (e.g., "Consolidated — 5 sources" or based on first file name)
- On completion, Claude **posts a summary message in chat** describing what was merged and any notable decisions (e.g., conflicting rows resolved)
- Source files remain in the sources panel after consolidation

### Chat streaming
- AI responses stream **token-by-token** using the Anthropic streaming API — responses appear word-by-word
- For consolidation specifically, Claude returns structured data (the merged spreadsheet) — streaming applies to the accompanying summary/chat message

### API key
- Hardcoded in index.html for Phase 4 (dev-only shortcut, clearly marked as temporary)
- Matches the existing no-build, no-env-file architecture of the project

### Conversation history (AI-04)
- History kept **in-memory only** (JS array of `{ role, content }` messages)
- Clears on page refresh — satisfies "within a session" requirement
- Each API call sends the full accumulated history for context

### Loading state
- While consolidation runs: **chat shows "Claude is consolidating..." typing indicator**, Consolidate button and chat input are disabled
- On success: result renders in editor, Claude posts summary message in chat
- On failure: Claude posts error message in chat (e.g., "Consolidation failed: [reason]. Please try again."), inputs re-enable

### Claude's Discretion
- Exact prompt engineering for the consolidation system prompt (how to instruct Claude to merge Excel data)
- How to encode .xlsx file contents for the API (likely read cell data via SheetJS, serialize as text/JSON in the prompt)
- Streaming implementation detail for token-by-token rendering in the existing `addMessage()` / chat bubble pattern
- Typing indicator animation design

</decisions>

<specifics>
## Specific Ideas

- STATE.md note: "addMessage() helper centralizes bubble creation — Phase 4 swaps mock response for real API call" — the integration point is clear, mock is in `sendMessage()` around line 1080
- Consolidation should feel like asking Claude a question and getting a result: trigger → loading → result in editor + summary in chat
- For the consolidation prompt, Claude needs the raw sheet data from each selected file — SheetJS `XLSX.utils.sheet_to_json()` or similar to serialize cell data before sending

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `addMessage(text, sender)` (index.html ~line 1049): Creates chat bubbles — extend to support streaming (append to existing bubble) and a "typing" placeholder state
- `sendMessage()` (index.html ~line 1069): Current mock — replace with real Anthropic API call, maintain conversation history array here
- `sources[]` array (index.html ~line 1105): Holds `{ type:'file', name, size, lastModified, file: File }` — raw `File` objects are available for SheetJS reading
- `window.openFile(fileObj)` (index.html ~line 1604): Opens a file in the Jspreadsheet editor — can be called with a synthetic File or Blob after consolidation
- `window._excelState` (index.html ~line 1542): `{ instance, workbook, fileName }` — exposes the live spreadsheet instance
- SheetJS (`XLSX`) already loaded via CDN — available for reading source files and writing the consolidated result

### Established Patterns
- Single `index.html` with inline `<script>` blocks and no build step — all new code goes in the same file
- `window._excelState` pattern for cross-IIFE state — consolidation result can follow the same pattern
- Construction-themed palette (slate/amber) — any new UI elements (checkboxes, loading indicator) should match
- `panel-header-action` CSS class pattern for header icon-buttons — Consolidate button should follow this pattern

### Integration Points
- Sources panel file rows (~line 1223): Add checkbox to each rendered file item
- Sources panel header: Add Consolidate button (follows `panel-header-action` pattern)
- `sendMessage()` function: Replace mock setTimeout with real API call + streaming
- `addMessage()` function: Extend to support a streaming/updating bubble (append tokens to existing bubble rather than creating a new one each token)
- Chat badge (`#chat-badge`): Update to show "Thinking…" or "Consolidating…" during operations

</code_context>

<deferred>
## Deferred Ideas

- AI chat commands to restructure templates (add/remove columns, change layout) — Phase 5 (AI-02)
- AI data operations (merge rows, filter, aggregate, fill from sources) — Phase 5 (AI-03)
- Persistent chat history across page refreshes — not needed for v1
- Named master records with metadata (report name, type, source, users, date) — Phase 6 (MSTR-01)

</deferred>

---

*Phase: 04-ai-consolidation*
*Context gathered: 2026-03-11*
