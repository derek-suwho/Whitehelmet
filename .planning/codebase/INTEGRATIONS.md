# External Integrations

**Analysis Date:** 2026-03-17

## APIs & External Services

**AI / LLM:**
- Anthropic Messages API
  - Endpoint: `https://api.anthropic.com/v1/messages`
  - API version header: `anthropic-version: 2023-06-01`
  - Model: `claude-opus-4-5`
  - Auth: `x-api-key` header using `state.apiKey` (set in `js/state.js`)
  - Special header required for direct browser access: `anthropic-dangerous-direct-browser-access: true`
  - Used in: `js/chat.js` (streaming SSE, `stream: true`), `js/consolidation.js` (non-streaming, `stream: false`)
  - Planned use in: `js/ai-operations.js` (Group 1 — NL spreadsheet commands)
  - Planned proxy: `/api/chat` backend route (Group 3 backend, not yet active)

**CDN — Runtime Libraries:**
- `https://cdn.tailwindcss.com` — Tailwind CSS Play CDN (v3)
- `https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js` — SheetJS
- `https://jsuites.net/v5/jsuites.js` + `jsuites.css` — jSuites
- `https://cdn.jsdelivr.net/npm/jspreadsheet-ce@5/dist/index.min.js` + `.min.css` — Jspreadsheet CE
- `https://fonts.googleapis.com` — Inter font (loaded via Tailwind font stack)

## Data Storage

**Databases:**
- None — no database present or planned

**Client-side State:**
- In-memory only; `state.conversationHistory` (array), `state.excelState` (object), `state.masterRecords` (array)
- All state is lost on page reload
- No localStorage, no IndexedDB, no sessionStorage detected

**File Storage:**
- Browser memory only — uploaded `.xlsx` files held as `File` objects in the sources array
- Exports written to user's local disk via `URL.createObjectURL(Blob)` + programmatic `<a>` click

**Caching:**
- None

## Authentication & Identity

**Auth Provider:**
- None — no user authentication or identity system present
- The only "auth" is the Anthropic API key stored as a string in `js/state.js`

## Monitoring & Observability

**Error Tracking:**
- None

**Logs:**
- Browser `console` only (no structured logging, no remote log service)

**Analytics:**
- None

## CI/CD & Deployment

**Hosting:**
- Not configured — app is a static file deployable to any static host (GitHub Pages, Netlify, Vercel, etc.)
- Development served by `node serve.mjs` on `http://localhost:3000`

**CI Pipeline:**
- None — no GitHub Actions, no CI config files detected

## Environment Configuration

**Required configuration:**
- `state.apiKey` in `js/state.js` — must be set to a valid Anthropic API key before use
  - Current value: `'YOUR_KEY_HERE'` (placeholder)
  - No `.env` file or environment variable mechanism exists

**No secrets files detected** — `.env` file not present in repo

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Planned / Scaffolded Integrations (Not Yet Active)

**Group 3 Backend Proxy:**
- Route: `/api/chat`
- Purpose: Proxy Anthropic API calls server-side to avoid exposing the API key in the browser
- Current status: Not implemented; all modules currently use `state.apiKey` directly
- Notes in `js/ai-operations.js` and `CLAUDE.md` instruct Group 1 to switch to `/api/chat` once available

## Browser APIs Used

These are native browser capabilities, not external integrations, but are critical runtime dependencies:

- `FileReader` (`readAsArrayBuffer`) — reading uploaded `.xlsx` files
- HTML5 Drag and Drop API (`dragover`, `drop`, `dragleave`) — source file drag-and-drop
- `DataTransferItem.webkitGetAsEntry()` + `FileSystemDirectoryReader.readEntries()` — folder upload
- `<input type="file" webkitdirectory multiple>` — folder picker
- `fetch()` — Anthropic API calls
- `ReadableStream.getReader()` + `TextDecoder` — SSE streaming response parsing
- `URL.createObjectURL(Blob)` — `.xlsx` download

---

*Integration audit: 2026-03-17*
