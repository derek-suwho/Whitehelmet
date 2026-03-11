# Coding Conventions

**Analysis Date:** 2026-03-10

## Naming Patterns

**Files:**
- Module files use `.mjs` extension for ES modules (e.g., `serve.mjs`, `screenshot.mjs`)
- HTML files use lowercase with `.html` extension (e.g., `index.html`)
- Directory names use lowercase with spaces for descriptive names (e.g., `temporary screenshots`)

**Functions:**
- Function names use camelCase (e.g., `addMessage`, `sendMessage`, `createServer`)
- Event handlers use camelCase with descriptive action verbs (e.g., `addEventListener`, `sendMessage`)
- Variable names use camelCase for single words or multi-word identifiers (e.g., `chatHistory`, `chatInput`, `emptyState`)

**Variables:**
- DOM element references use camelCase with element type suffix (e.g., `chatHistory`, `chatInput`, `chatSendBtn`)
- Constants use UPPER_SNAKE_CASE (e.g., `AI_MOCK_REPLY`, `MIME_TYPES`, `CHROME_PATHS`, `PORT`)
- Local variables use camelCase (e.g., `urlPath`, `filePath`, `contentType`)

**Types:**
- Object properties use camelCase (e.g., `executablePath`, `headless`, `waitUntil`)
- HTML element IDs use camelCase (e.g., `chatHistory`, `chatInput`, `chatEmptyState`)
- CSS class names use kebab-case with BEM-like structure (e.g., `chat-bubble`, `chat-bubble-user`, `panel-header`)

## Code Style

**Formatting:**
- No explicit linter configured (no ESLint, Prettier)
- Consistent 2-space indentation throughout codebase
- Lines wrap naturally; no strict line length enforcement observed
- Single quotes preferred in JavaScript code (`'text'`)

**Linting:**
- No linting configuration file present
- Manual code review approach appears to be in use

## Import Organization

**Order:**
1. Node.js built-in modules first (`http`, `fs`, `path`)
2. Third-party packages next (`puppeteer`)
3. Utility imports (`fileURLToPath`)
4. Constant declarations follow imports

**Path Aliases:**
- No path aliases configured
- Relative file paths use `path.join()` and `path.dirname()` for cross-platform compatibility
- Uses ES module URL resolution with `import.meta.url` for obtaining directory paths

**Pattern (ES Modules):**
```javascript
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

## Error Handling

**Patterns:**
- Server-side: Callback-based error handling with status code checks (e.g., `err.code === 'ENOENT'`)
- HTTP errors: Explicit response codes (404 Not Found, 500 Internal Server Error)
- CLI validation: Early exit pattern with `process.exit(1)` for missing required arguments
- Puppeteer operations: Uses async/await with timeout configuration

**Observed approach:**
- Errors logged to console with `console.error()` and `console.log()`
- Response headers set before sending body data
- File system operations use error callbacks in `fs.readFile()`

## Logging

**Framework:** `console` object (no external logging library)

**Patterns:**
- Informational messages use `console.log()` with user-facing information
- Error conditions use `console.error()` for stderr output
- Logs include contextual information: `http://localhost:${PORT}`, `Screenshot saved: ${outputPath}`
- Logging includes variable interpolation with template literals

**Locations:**
- Server startup: `serve.mjs` line 51-52
- Screenshot completion: `screenshot.mjs` line 44
- CLI errors: `screenshot.mjs` line 9

## Comments

**When to Comment:**
- Inline comments explain non-obvious logic or configuration
- Comments describe the purpose of code sections (e.g., "Mock AI response after 500ms")
- Comments clarify browser chrome paths and their purpose

**JSDoc/TSDoc:**
- No JSDoc comments observed in codebase
- Not applicable for this project (no type annotations)

## Function Design

**Size:**
- Small, focused functions (most under 15 lines)
- `addMessage()`: 13 lines (DOM manipulation + scrolling)
- `sendMessage()`: 13 lines (input handling + async response)
- Server request handler: 25 lines with error handling

**Parameters:**
- Limited parameters per function (1-2 typical)
- DOM elements passed as references
- Configuration passed as plain objects (e.g., `{ recursive: true }`)

**Return Values:**
- DOM manipulation functions return created elements
- Event handlers typically return void
- File operations use callbacks with error-first pattern

## Module Design

**Exports:**
- Server script (`serve.mjs`): No explicit exports; runs as standalone HTTP server
- Screenshot script (`screenshot.mjs`): No exports; executes directly with CLI arguments
- HTML file (`index.html`): Embedded inline scripts; no module exports

**Barrel Files:**
- Not applicable; no barrel/index pattern used
- Each script is independently executable

**Module Pattern:**
- Server uses IIFE (Immediately Invoked Function Expression) in HTML for encapsulation
- CLI scripts execute at module load time without wrapping
- Separation of concerns: separate scripts for server, screenshots, and UI

---

*Convention analysis: 2026-03-10*
