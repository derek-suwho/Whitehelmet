# Architecture

**Analyzed:** 2026-03-17

---

## Pattern

**Single-page application** with vanilla JS ES modules. No build step, no bundler, no framework. The app runs directly in the browser from `index.html` with native `<script type="module">` imports.

---

## Layers

```
index.html          → Entry HTML, loads CDN libraries + js/app.js as module
js/app.js           → Orchestrator: imports and calls init() on all modules in order
js/state.js         → Shared state singleton: all modules read/write here
js/chat.js          → Chat panel UI + Anthropic API proxy
js/excel-editor.js  → Jspreadsheet CE wrapper, file open/close, download
js/file-ingestion.js → File upload, source panel, xlsx parsing via SheetJS
js/consolidation.js → AI-driven multi-file merge, sends to Anthropic API
js/ai-operations.js → [STUB] Natural language spreadsheet operations (Phase 5)
js/master-records.js → [STUB] Consolidated report dashboard (Phase 6)
css/                → Stylesheets (one per concern)
serve.mjs           → Minimal Node.js dev server (no build tooling needed)
```

---

## Data Flow

```
User uploads .xlsx files
  → file-ingestion.js (parse with SheetJS → store in state.sourceFiles)
  → Sources panel updated

User clicks Consolidate
  → consolidation.js (reads state.sourceFiles, calls Anthropic /api/chat or direct)
  → AI returns merged data structure
  → excel-editor.js (populates Jspreadsheet instance)
  → Spreadsheet panel updated

User types chat message
  → chat.js (checks state.chatCommandHandler first)
  → If handler returns true: ai-operations.js handles it, mutates spreadsheet
  → If handler returns false/null: message sent to Anthropic, response shown in chat

User downloads
  → excel-editor.js (reads Jspreadsheet data, serializes via SheetJS, triggers download)
```

---

## Module Initialization

`js/app.js` calls `init()` on each module in dependency order:

1. `initChat()` — registers `state.addMessage`
2. `initExcelEditor()` — registers `state.openFile`, `state.closeFile`, `state.excelState.instance`
3. `initFileIngestion()` — depends on openFile/closeFile being registered
4. `initConsolidation()` — depends on addMessage + excelState
5. `initAiOperations()` — registers `state.chatCommandHandler` (Phase 5)
6. `initMasterRecords()` — standalone dashboard (Phase 6)

---

## Cross-Module Communication

All inter-module communication goes through `js/state.js`:

- **Function registration pattern:** modules register callbacks on `state` during `init()`
- **No direct imports between peer modules** — everything routes through state
- **No events/pub-sub** — synchronous function calls only

---

## Entry Points

- **Browser:** `index.html` → `<script type="module" src="js/app.js">`
- **Dev server:** `node serve.mjs` → serves static files at `http://localhost:3000`
- **No build, no transpilation** — ES modules run natively in modern browsers

---

## External Dependencies (CDN-loaded)

All loaded via `<script>` tags in `index.html`:

| Library | Purpose |
|---------|---------|
| Jspreadsheet CE | In-browser spreadsheet grid |
| Jsuites | Jspreadsheet UI dependency |
| SheetJS (xlsx) | Excel file parsing and generation |

No npm-installed frontend dependencies. `package.json` only has `serve` and `puppeteer` (for `screenshot.mjs`).
