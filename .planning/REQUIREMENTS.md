# Requirements: Whitehelmet AI Chat Operations

**Defined:** 2026-03-17
**Core Value:** User can modify the open spreadsheet using plain English chat commands and see the change applied immediately

## v1 Requirements

### Command Routing

- [x] **ROUTE-01**: `initAiOperations()` registers a handler at `state.chatCommandHandler` during module init
- [x] **ROUTE-02**: Handler returns `true` if the message was recognized as a spreadsheet command (preventing fallthrough to normal chat)
- [x] **ROUTE-03**: Handler returns `false` if the message is not a spreadsheet command (normal chat proceeds)

### Intent Parsing

- [x] **PARSE-01**: Handler calls Anthropic API (using `state.apiKey`) with the user's message and current spreadsheet headers to classify intent
- [x] **PARSE-02**: Claude returns a structured operation object (type + parameters) that the handler executes
- [x] **PARSE-03**: If Claude cannot parse a clear intent, the handler posts an error message via `state.addMessage()` and returns `true`

### Template Operations

- [x] **TMPL-01**: User can type a command to add a new column (with optional name and position) and it appears in the spreadsheet
- [x] **TMPL-02**: User can type a command to remove an existing column by name and it is deleted from the spreadsheet
- [x] **TMPL-03**: User can type a command to rename a column header and the header updates in the spreadsheet
- [x] **TMPL-04**: User can type a command to apply a formula to a column and the formula is set on each cell in that column

### Data Operations

- [ ] **DATA-01**: User can type a command to sort rows by a named column (ascending or descending) and rows reorder accordingly
- [ ] **DATA-02**: User can type a command to filter rows by a condition and non-matching rows are hidden or removed
- [ ] **DATA-03**: User can type a command to remove empty rows and blank rows are deleted from the spreadsheet
- [ ] **DATA-04**: User can type a command to aggregate a column (sum, average, count) and the result is posted in chat

### Feedback

- [x] **UX-01**: After a successful operation, the handler posts a confirmation message in chat (e.g. "Added column 'Total'")
- [x] **UX-02**: If an operation fails or the intent is ambiguous, the handler posts a clear error message in chat explaining what went wrong
- [x] **UX-03**: While Claude is processing, a "thinking..." indicator is shown in chat

## v2 Requirements

### Extended Operations

- **EXT-01**: Fill cells from a pattern or source file data
- **EXT-02**: Multi-step conversational commands ("now also do X to that column")
- **EXT-03**: Undo last AI operation

### Robustness

- **ROB-01**: Route through `/api/chat` proxy once Group 3's backend is available (currently uses `state.apiKey` directly)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Undo/redo | No undo API in Jspreadsheet CE |
| Multi-turn conversation | Stateless handler keeps v1 simple |
| Modifying other team files | Group boundary — only `js/ai-operations.js` (and `js/chat.js` if needed) |
| Formula engine / computed columns | Jspreadsheet CE has limited formula support |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ROUTE-01 | Phase 1 | Complete |
| ROUTE-02 | Phase 1 | Complete |
| ROUTE-03 | Phase 1 | Complete |
| PARSE-01 | Phase 1 | Complete |
| PARSE-02 | Phase 1 | Complete |
| PARSE-03 | Phase 1 | Complete |
| TMPL-01 | Phase 1 | Complete |
| TMPL-02 | Phase 1 | Complete |
| TMPL-03 | Phase 1 | Complete |
| TMPL-04 | Phase 1 | Complete |
| DATA-01 | Phase 2 | Pending |
| DATA-02 | Phase 2 | Pending |
| DATA-03 | Phase 2 | Pending |
| DATA-04 | Phase 2 | Pending |
| UX-01 | Phase 1 | Complete |
| UX-02 | Phase 1 | Complete |
| UX-03 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-03-17 after initial definition*
