# Whitehelmet — AI Chat Operations (Group 1)

## What This Is

Whitehelmet is a web app for construction companies that consolidates subcontractor Excel reports. The core app (phases 1–4) is complete: users can upload .xlsx files, view them in a browser spreadsheet editor, and use Claude to merge multiple reports into one master record.

This planning context covers **Group 1's contribution**: natural language spreadsheet editing. When a user types a command in the chat ("add a Total column", "remove empty rows", "sort by date"), the handler intercepts it, calls Claude to parse intent into a structured operation, and applies it to the live spreadsheet.

## Core Value

A user can modify the open spreadsheet using plain English chat commands and see the change applied immediately — no need to know spreadsheet syntax or manually edit cells.

## Requirements

### Validated

- ✓ Three-panel UI (sources, spreadsheet editor, chat) — existing
- ✓ File upload and xlsx parsing via SheetJS — existing
- ✓ Jspreadsheet CE instance accessible at `state.excelState.instance` — existing
- ✓ Chat panel with `state.addMessage()` for posting messages — existing
- ✓ `state.chatCommandHandler` hook wired in chat.js — existing
- ✓ Anthropic API key at `state.apiKey` — existing

### Active

- [ ] User can type a natural language command to add, remove, or rename columns
- [ ] User can type a natural language command to change column layout or apply a formula
- [ ] User can type a natural language command to sort, filter, or merge rows
- [ ] User can type a natural language command to aggregate values or fill cells from source files
- [ ] When a command is ambiguous or fails, the user sees a clear error message in chat
- [ ] Handler returns `false` for non-spreadsheet messages, letting them fall through to normal chat

### Out of Scope

- Undo/redo for AI operations — no undo API in Jspreadsheet CE; deferred
- Multi-step conversational workflows (e.g., "now also do X") — single-command operations only for v1
- Modifying files other than `js/ai-operations.js` (and `js/chat.js` if routing needs adjusting) — team boundary
- Backend proxy (`/api/chat`) — use `state.apiKey` directly until Group 3's backend is ready

## Context

- **Existing hook:** `state.chatCommandHandler` receives every chat message before it goes to the normal AI chat. Return `true` = handled, `false` = pass through.
- **Spreadsheet API:** Jspreadsheet CE instance at `state.excelState.instance` — use its API to read/mutate data (getJson, setData, insertColumn, deleteColumn, orderBy, etc.)
- **AI approach:** Call Anthropic API with the user's message + current spreadsheet structure → get back a structured operation → execute it against the Jspreadsheet instance
- **No build step:** Vanilla JS ES modules, runs directly in browser. No TypeScript, no bundler.
- **Codebase map:** See `.planning/codebase/` for full architecture, conventions, and concerns

## Constraints

- **Tech stack:** Vanilla JS ES modules only — no npm packages, no build step
- **File boundary:** Implement in `js/ai-operations.js`; touch `js/chat.js` only if routing requires it; do not touch any other files
- **API:** Use `state.apiKey` directly (Anthropic API) until `/api/chat` proxy is available
- **Spreadsheet:** Jspreadsheet CE (not Pro) — limited API surface, no formula engine in CE

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Claude parses intent into structured ops | More reliable than free-form code generation; lets us validate before applying | — Pending |
| Error shown in chat on failure | User needs feedback; silent failures are confusing in a chat UI | — Pending |
| Single-command model (no conversation) | Keeps handler stateless and simple for v1 | — Pending |

---
*Last updated: 2026-03-17 after initialization*
