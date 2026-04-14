# Coding Conventions

**Analysis Date:** 2026-03-17

## Naming Patterns

**Files:**
- kebab-case for JS modules: `ai-operations.js`, `excel-editor.js`, `file-ingestion.js`, `master-records.js`
- kebab-case for CSS: `master-records.css`, `styles.css`
- camelCase for server/tool scripts: `serve.mjs`, `screenshot.mjs`

**Functions:**
- camelCase for all function names: `initChat()`, `initExcelEditor()`, `addMessage()`, `sendMessage()`, `readFileAsAOA()`, `getCheckedFiles()`, `formatFileSize()`, `truncateName()`, `deleteSource()`, `wireEmptyState()`
- `init*` prefix for module entry-point functions: `initChat`, `initExcelEditor`, `initFileIngestion`, `initConsolidation`, `initAiOperations`, `initMasterRecords`
- `create*` prefix for DOM factory functions: `createFileItem()`, `createFolderItem()`
- Event handler functions are anonymous: `sendBtn.addEventListener('click', function () { ... })`

**Variables:**
- camelCase for local variables: `checkedFiles`, `fileDataArr`, `currentInstance`, `panelBody`, `fullResponse`
- ALL_CAPS for module-level constants: `ANTHROPIC_API_URL`, `SYSTEM_PROMPT`, `EMPTY_CENTER_HTML`, `FILE_ICON`, `FOLDER_ICON`
- MIME_TYPES in `serve.mjs`
- Short abbreviations are common for DOM references: `cb` (checkbox), `dz` (drop zone), `wb` (workbook), `ws` (worksheet), `f` (file)

**Types:**
- No TypeScript. No JSDoc type annotations. Types are implicit.

**CSS Classes:**
- BEM-style with hyphens: `.panel-left`, `.panel-header`, `.panel-body`, `.source-item`, `.source-item-name`, `.source-item-meta`, `.source-folder-children`, `.msg-bubble`, `.chat-empty-state`

## Code Style

**Formatting:**
- No formatter configured (no `.prettierrc`, no `biome.json`, no `.editorconfig`)
- Indentation: 2 spaces throughout all JS files
- Single quotes for strings in JS (consistent across all modules)
- Semicolons used at end of statements

**Variable declarations:**
- `var` is the primary declaration keyword throughout all existing modules (`js/chat.js`, `js/excel-editor.js`, `js/file-ingestion.js`, `js/consolidation.js`)
- `const` and `let` appear only in `serve.mjs` (Node.js ESM context)
- New group code in `js/ai-operations.js` should use `var` to match existing style

**Linting:**
- No ESLint config detected. No linting enforced.

## Import Organization

**Pattern:**
- Single import per module: `import { state } from './state.js';`
- All modules import only from `./state.js` — no cross-module imports
- External libraries (SheetJS, Jspreadsheet, Tailwind) are loaded globally via CDN in `index.html` and accessed as globals (`XLSX`, `jspreadsheet`)
- No barrel files

**Module system:**
- Native ES modules (`type: "module"` in `package.json`)
- Each module exports exactly one named function: `export function init*() { ... }`
- `js/app.js` is the sole orchestrator that imports and calls all `init*` functions

## Error Handling

**Patterns:**
- `try/catch/finally` blocks wrap async API calls in `js/chat.js` and `js/consolidation.js`
- `finally` block always re-enables UI inputs and resets badge text
- Errors are surfaced to the user via `state.addMessage(message, 'ai')` — no console logging
- Silent catch for expected failures: `try { currentInstance.destroy(); } catch (ex) {}` in `js/excel-editor.js`
- JSON parse errors in SSE stream are silently ignored: `catch (parseErr) { // Ignore malformed SSE lines }`
- Error messages concatenate `err.message` directly into user-visible strings: `'Consolidation failed: ' + err.message + '. Please try again.'`
- Command handler errors in `js/chat.js` are caught at the call site and shown in chat: `addMessage('Command error: ' + handlerErr.message, 'ai')`

**Guard clauses:**
- Early returns for invalid state: `if (!state.excelState.instance) return false;`
- Guard for missing checked files: `if (checkedFiles.length === 0) { state.addMessage(...); return; }`
- Null checks before calling registered functions: `if (state.openFile) state.openFile(f.file);`

## Logging

**Framework:** None — no logging library.

**Patterns:**
- No `console.log` calls in any JS module
- `console.log` appears only in `serve.mjs`: `console.log(\`Server running at http://localhost:${PORT}\`)`
- User-visible feedback is delivered exclusively via `state.addMessage(text, 'ai')` or direct DOM manipulation

## Comments

**When to Comment:**
- Block comments at top of each file declare ownership and purpose: `// ── AI Spreadsheet Operations (Group 1) ─────────────────`
- Inline section dividers use the Unicode dash pattern: `// ── Section Name ─────────────────────`
- Inline comments on non-obvious logic: `// Keep incomplete line in buffer`, `// Split on newline SSE boundaries`
- TODOs use format: `// TODO: Group 1 implements here`

**JSDoc/TSDoc:**
- Not used anywhere in the codebase.

## Function Design

**Size:** Functions are medium-length. `sendMessage()` in `js/chat.js` is ~115 lines and handles the full async SSE flow inline. `consolidate()` in `js/consolidation.js` is ~90 lines. Smaller helper functions (`formatFileSize`, `truncateName`, `formatDate`) are 3–8 lines.

**Parameters:** Functions use zero to two parameters. DOM event handlers are zero-parameter. Module-internal helpers take simple values: `deleteSource(index)`, `truncateName(name, max)`, `addMessage(text, sender, skipHistory)`.

**Return Values:**
- Init functions return nothing (side-effect only)
- `chatCommandHandler` must return a boolean (`true` = handled, `false` = pass through) — this is the interface contract for `js/ai-operations.js`
- DOM factory functions return the created element: `createFileItem()`, `createFolderItem()`
- Promise-returning functions: `readFileAsAOA(file)` returns `Promise<object>`, `traverseDirectory(dirEntry)` returns `Promise<File[]>`

## Module Design

**Exports:**
- Each module exports exactly one named function: `export function init*() { ... }`
- All inter-module communication goes through `state` object — never import other modules

**State registration pattern:**
- Modules register their functions onto `state` during init:
  ```js
  state.chatCommandHandler = async function (userText) { ... };
  state.addMessage = addMessage;
  state.openFile = function (fileObj) { ... };
  ```
- Consumers check for null before calling: `if (state.chatCommandHandler) { ... }`

**Barrel files:** Not used.

---

*Convention analysis: 2026-03-17*
