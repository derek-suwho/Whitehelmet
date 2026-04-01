# Architecture

**Analysis Date:** 2026-03-17

## Pattern Overview

**Overall:** Modular Single-Page Application with Shared State Pattern

**Key Characteristics:**
- No build step — vanilla JS ES modules delivered via CDN with external libraries
- Three-panel reactive UI (Sources, Excel Editor, AI Chat)
- Event-driven module initialization with phase ordering
- Centralized shared state (`state.js`) for cross-module communication
- Function registration pattern — modules register callbacks on init
- Group-based ownership model with clear boundaries

## Layers

**Presentation Layer:**
- Purpose: DOM manipulation, rendering, user interaction handling
- Location: `js/file-ingestion.js`, `js/excel-editor.js`, `js/chat.js`
- Contains: Event listeners, DOM builders, visual state management
- Depends on: `state.js`, external DOM APIs (Jspreadsheet, SheetJS)
- Used by: Browser runtime

**State Management Layer:**
- Purpose: Single source of truth for application data and function registry
- Location: `js/state.js`
- Contains: Global state object with properties and function pointers
- Depends on: Nothing (no imports)
- Used by: All modules for data access and cross-module communication

**Business Logic Layer:**
- Purpose: Core operations — file consolidation, spreadsheet operations, chat interaction
- Location: `js/consolidation.js`, `js/ai-operations.js`, `js/master-records.js`
- Contains: API calls, data transformation, algorithmic operations
- Depends on: `state.js`, external APIs (Anthropic, SheetJS, Jspreadsheet)
- Used by: Presentation layer through event handlers

**Orchestration Layer:**
- Purpose: Bootstrap modules in correct order, manage initialization sequence
- Location: `js/app.js`
- Contains: Import statements, ordered `init()` calls
- Depends on: All module exports
- Used by: index.html as single entry point

## Data Flow

**File Upload to Spreadsheet Display:**

1. User drops/selects files via `file-ingestion.js` dropzone or file inputs
2. Files stored in local `sources[]` array within `initFileIngestion()` closure
3. User clicks a file → calls `state.openFile(fileObj)`
4. `excel-editor.js` reads file with SheetJS, creates Jspreadsheet instance
5. Instance stored in `state.excelState.instance` and DOM
6. File data visible in center panel

**Consolidation Flow:**

1. User checks files in left panel and clicks "Consolidate"
2. `consolidation.js` collects checked files via `document.querySelectorAll('.source-check:checked')`
3. Each file read into array-of-arrays format via SheetJS
4. Data sent to Anthropic API with system prompt for merging
5. API returns JSON rows + SUMMARY text
6. Summary posted to chat via `state.addMessage(summary, 'ai')`
7. Result can be opened via `state.openFile()` (if persisted)

**Chat to AI Operations (Group 1 Integration):**

1. User types message in chat input
2. `chat.js` checks if `state.chatCommandHandler` exists
3. If exists, calls `await state.chatCommandHandler(userText)` before API call
4. `ai-operations.js` (Group 1) returns `true` if handled (spreadsheet command) or `false` (normal chat)
5. If `false`, normal Claude API call proceeds
6. Response streamed back via SSE and displayed in chat

**State Management:**

- User messages and AI responses accumulated in `state.conversationHistory[]` (role/content pairs)
- Excel editor state held in `state.excelState` (instance, workbook, fileName)
- Master records stored in `state.masterRecords[]` (Group 2)
- All state mutations go through registered functions or direct property assignment

## Key Abstractions

**Sources Container:**
- Purpose: Manages file and folder tree for upload
- Examples: `js/file-ingestion.js` (lines 4-11, sources array)
- Pattern: Local closure variable with render/mutation functions

**Jspreadsheet Instance Wrapper:**
- Purpose: Encapsulates spreadsheet lifecycle — init, mutation, destruction
- Examples: `js/excel-editor.js` (state.excelState object)
- Pattern: Stored in `state.excelState.instance` with lifecycle hooks (openFile/closeFile)

**State Function Registry:**
- Purpose: Allows modules to discover cross-module functions without circular imports
- Examples: `state.addMessage`, `state.openFile`, `state.chatCommandHandler`, `state.saveMasterRecord`
- Pattern: Null-initialized in `state.js`, assigned during each module's `init()`

**Consolidation Prompt Pipeline:**
- Purpose: Converts Excel data to AI-understandable JSON, processes response
- Examples: `js/consolidation.js` (lines 6-12 system prompt, lines 39-150 consolidation flow)
- Pattern: Read files → serialize as JSON → send to API → parse response into data + summary

## Entry Points

**index.html:**
- Location: `index.html`
- Triggers: Browser page load
- Responsibilities: Defines DOM structure, loads CDN libraries (Tailwind, SheetJS, Jspreadsheet), imports app.js

**js/app.js:**
- Location: `js/app.js`
- Triggers: Loaded as ES module from index.html
- Responsibilities: Imports all modules, calls init functions in phase order (chat → excel-editor → file-ingestion → consolidation → ai-operations → master-records)

**initChat():**
- Location: `js/chat.js` export
- Triggers: Called during app.js bootstrap
- Responsibilities: Registers `state.addMessage`, wires chat input/button, implements message sending and SSE streaming

**initExcelEditor():**
- Location: `js/excel-editor.js` export
- Triggers: Called during app.js bootstrap
- Responsibilities: Registers `state.openFile` and `state.closeFile`, creates Jspreadsheet instances, handles download/export

**initFileIngestion():**
- Location: `js/file-ingestion.js` export
- Triggers: Called during app.js bootstrap
- Responsibilities: Manages sources panel, file/folder upload, deduplication, selection, rendering

**initConsolidation():**
- Location: `js/consolidation.js` export
- Triggers: Called during app.js bootstrap
- Responsibilities: Wires consolidate button click handler, orchestrates multi-file consolidation via API

**initAiOperations():**
- Location: `js/ai-operations.js` export
- Triggers: Called during app.js bootstrap
- Responsibilities: (Group 1) Registers `state.chatCommandHandler` to intercept and apply spreadsheet commands

**initMasterRecords():**
- Location: `js/master-records.js` export
- Triggers: Called during app.js bootstrap
- Responsibilities: (Group 2) Registers `state.saveMasterRecord`, `state.showDashboard`, `state.hideDashboard`; renders dashboard in #dashboard-root

## Error Handling

**Strategy:** Try-catch blocks with graceful user messaging

**Patterns:**
- File read errors in consolidation are caught and message posted to chat (line 149 in consolidation.js)
- API errors caught at fetch level with response status checked before parsing (chat.js lines 104-107)
- SSE parsing errors silently ignored to prevent stream corruption (chat.js lines 136-138)
- Spreadsheet destroy wrapped in try-catch to suppress errors on unmounted instances (excel-editor.js lines 26, 76)
- FileReader onerror rejects promise (consolidation.js line 34)

## Cross-Cutting Concerns

**Logging:** Console.log not used; errors surfaced to user via `state.addMessage(text, 'ai')`

**Validation:**
- File type validation: `.xlsx` extension check in `file-ingestion.js` (lines 57, 79)
- Consolidation guard: Empty file check before API call (consolidation.js lines 47-50)
- Message input trimming before send (chat.js line 40)

**Authentication:**
- Anthropic API key held in `state.apiKey` (hardcoded TODO in state.js line 8)
- Sent as `x-api-key` header in fetch requests
- Browser-direct API access flag: `anthropic-dangerous-direct-browser-access: true` (consolidation.js line 78, chat.js line 93)

---

*Architecture analysis: 2026-03-17*
