# Roadmap: Whitehelmet AI Chat Operations (Group 1)

## Overview

Two phases deliver natural language spreadsheet editing on top of the existing Whitehelmet app. Phase 1 wires up the command handler, connects to the Anthropic API for intent parsing, and delivers structural column operations with user feedback. Phase 2 adds row-level data operations (sort, filter, remove empties, aggregate) that depend on the routing and parsing infrastructure Phase 1 establishes.

## Phases

- [x] **Phase 1: Command Routing, Intent Parsing, and Column Operations** - Wire the handler, parse intent via Claude, and implement add/remove/rename/formula column commands with chat feedback (completed 2026-04-08)
- [ ] **Phase 2: Row and Data Operations** - Add sort, filter, remove-empty-rows, and aggregate commands on top of Phase 1 infrastructure

## Phase Details

### Phase 1: Command Routing, Intent Parsing, and Column Operations
**Goal**: Users can type natural language column commands in chat and see the spreadsheet update immediately, with clear feedback on success or failure
**Depends on**: Nothing (first phase) — existing infrastructure (state.chatCommandHandler, state.excelState.instance, state.addMessage, state.apiKey) is already in place
**Requirements**: ROUTE-01, ROUTE-02, ROUTE-03, PARSE-01, PARSE-02, PARSE-03, TMPL-01, TMPL-02, TMPL-03, TMPL-04, UX-01, UX-02, UX-03
**Success Criteria** (what must be TRUE):
  1. Typing a spreadsheet command (e.g. "add a Total column") in chat causes the spreadsheet to update; non-spreadsheet messages fall through to normal chat unchanged
  2. User can add a new column by name and position, and it appears in the spreadsheet grid
  3. User can remove an existing column by name, and it disappears from the spreadsheet
  4. User can rename a column header, and the header text updates in place
  5. After every command, a confirmation or error message appears in the chat panel; a "thinking..." indicator is shown while Claude processes
**Plans:** 2/2 plans complete

Plans:
- [x] 01-01-PLAN.md — Command handler registration, intent parsing via Claude API, thinking indicator
- [ ] 01-02-PLAN.md — Four column operations (add, remove, rename, formula) with confirmation and error messages

### Phase 2: Row and Data Operations
**Goal**: Users can type natural language row and aggregate commands to reorder, clean, and summarize spreadsheet data
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. User can type "sort by [column] ascending/descending" and rows reorder in the spreadsheet
  2. User can type a filter condition and non-matching rows are hidden or removed
  3. User can type "remove empty rows" and blank rows are deleted from the spreadsheet
  4. User can type "sum/average/count [column]" and the result appears as a message in chat
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Command Routing, Intent Parsing, and Column Operations | 2/2 | Complete   | 2026-04-08 |
| 2. Row and Data Operations | 0/TBD | Not started | - |
