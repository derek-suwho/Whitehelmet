# Technology Stack

**Analysis Date:** 2026-03-17

## Languages

**Primary:**
- JavaScript (ES6+) — all application logic in `js/*.js` and `index.html`
  - Async/await used throughout API and file-reading paths
  - ES modules (`import`/`export`) used in all `js/` files
  - No TypeScript

**Markup / Style:**
- HTML5 — single entry point `index.html`
- CSS — hand-written styles in `css/styles.css` and `css/master-records.css`

## Runtime

**Environment:**
- Browser (primary runtime — all application logic runs client-side)
- Node.js (dev tooling only — not in any runtime path)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

**Local Dev Server:**
- `serve.mjs` — custom Node.js `http` module static file server, port 3000
- Start command: `node serve.mjs`

## Frameworks

**CSS Utility:**
- Tailwind CSS v3 (Play CDN) — loaded from `https://cdn.tailwindcss.com`
  - Configured inline in `index.html` via `tailwind.config` script block
  - Custom design tokens: `brand.*`, `surface.*`, `content.*` color palettes
  - Custom font families: `display` (Georgia/Cambria serif), `sans` (Inter)

**Spreadsheet Display:**
- Jspreadsheet CE v5 — loaded from `https://cdn.jsdelivr.net/npm/jspreadsheet-ce@5/dist/index.min.js`
  - CSS: `https://cdn.jsdelivr.net/npm/jspreadsheet-ce@5/dist/jspreadsheet.min.css`
  - In-browser editable spreadsheet grid with multi-worksheet/tab support
  - API used via `state.excelState.instance` (the live Jspreadsheet instance)

**Spreadsheet Peer Dependency:**
- jSuites v5 — loaded from `https://jsuites.net/v5/jsuites.js`
  - CSS: `https://jsuites.net/v5/jsuites.css`
  - Required peer dependency of Jspreadsheet CE; provides tab/worksheet UI

**Spreadsheet Parse/Write:**
- SheetJS (xlsx) v0.20.3 — loaded from `https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js`
  - Parses uploaded `.xlsx` files via `XLSX.read`
  - Converts sheets to array-of-arrays via `XLSX.utils.sheet_to_json`
  - Writes `.xlsx` binary for download via `XLSX.write`

**Typography:**
- Inter font — loaded from `https://fonts.googleapis.com` (implicit via Tailwind font stack)

**Testing:**
- None — no test framework present

**Build/Dev:**
- puppeteer v24.39.0 (devDependency) — headless browser for `screenshot.mjs`
- No bundler, no transpiler, no build step

## Key Dependencies

**Runtime (CDN — zero npm installs required at runtime):**
- `jspreadsheet-ce@5` — in-browser spreadsheet editing grid
- `jsuites@v5` — peer dependency for Jspreadsheet tab UI
- `xlsx@0.20.3` (SheetJS) — `.xlsx` parse, convert, write
- Tailwind CSS v3 — utility CSS
- Anthropic Messages API (external service, not a package)

**Dev only (npm):**
- `puppeteer ^24.39.0` — screenshot tooling (`screenshot.mjs`)
- `serve` (npx, not installed) — alternative static server

## Module System

All `js/` files use native ES modules (`type: "module"` in `package.json`).
`index.html` loads `js/app.js` as `<script type="module">`.
`js/app.js` imports and calls `init*()` from each module in dependency order:
1. `initChat()` — registers `state.addMessage`
2. `initExcelEditor()` — registers `state.openFile`, `state.closeFile`
3. `initFileIngestion()`
4. `initConsolidation()`
5. `initAiOperations()` — registers `state.chatCommandHandler`
6. `initMasterRecords()`

Shared state is exported from `js/state.js` and imported by all modules.

## Configuration

**Environment:**
- `state.apiKey` in `js/state.js` — Anthropic API key, placeholder value `'YOUR_KEY_HERE'`
- No `.env` file mechanism; key is set directly in source (marked TODO before sharing)

**Build:**
- None required — no config files for bundler, transpiler, or test runner
- `serve.mjs` is the only server config (MIME types hardcoded inline)

**Tailwind:**
- Configured inline in `index.html` lines 16–65 via `tailwind.config = { theme: { extend: { ... } } }`

## Platform Requirements

**Development:**
- Node.js (any recent LTS) for running `serve.mjs`
- Modern browser with ES module support, FileReader API, Fetch API, SSE (`getReader`)

**Production:**
- Any static file host (no server-side logic)
- Zero runtime npm dependencies

---

*Stack analysis: 2026-03-17*
