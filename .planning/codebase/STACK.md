# STACK.md

## Runtime

| Item | Value |
|------|-------|
| Platform | Node.js (ES Modules, `"type": "module"`) |
| Node version | Not pinned (no `.nvmrc`, no `engines` field) |
| Package manager | npm (package-lock.json present) |

---

## Languages

| Language | Usage |
|----------|-------|
| JavaScript (vanilla) | All application logic, in `index.html` `<script>` block and `.mjs` utilities |
| HTML | UI structure, single `index.html` file (739 lines) |
| CSS | Inline `<style>` block in `index.html` + Tailwind utility classes |

No TypeScript. No transpilation or build step.

---

## Frontend Framework

**None.** Pure vanilla JavaScript + HTML + CSS.

- DOM manipulation via `document.querySelector`, `classList`, `innerHTML`
- No React, Vue, Svelte, or similar
- No state management library

---

## CSS

| Tool | How Used |
|------|----------|
| Tailwind CSS | Loaded via CDN `<script src="https://cdn.tailwindcss.com">` |
| Inline styles | Some `<style>` block overrides in `index.html` |
| Google Fonts | Inter font family via CDN link |

Tailwind configuration is defined inline via `tailwind.config` in the HTML file.

---

## Dependencies

**Production (`dependencies`):**

| Package | Version | Purpose |
|---------|---------|---------|
| `puppeteer` | `^24.39.0` | Headless browser for screenshot capture utility |

**Dev dependencies:** None declared.

---

## Dev Utilities

| File | Purpose |
|------|---------|
| `Whitehelmet/serve.mjs` | Simple Node.js HTTP static file server on port 3000 |
| `Whitehelmet/screenshot.mjs` | Puppeteer-based screenshot capture tool |

---

## Module System

ES Modules throughout:
- `package.json` has `"type": "module"`
- All utility files use `.mjs` extension with `import`/`export` syntax
- `index.html` uses vanilla `<script>` (not modules)

---

## Asset Delivery

- Static files served directly from `Whitehelmet/` by `serve.mjs`
- No bundler (Webpack, Vite, Rollup, etc.)
- No asset fingerprinting or cache-busting
- Screenshots saved locally to `Whitehelmet/temporary screenshots/`

---

## Configuration

No environment variables used. No `.env` file. No config files beyond `package.json`.

---

## Platform Requirements

- macOS (screenshot.mjs has hardcoded macOS Chrome paths)
- Node.js with ES module support
- Chrome for Testing installed at one of the hardcoded paths (for screenshot utility)

---

## Repository

- GitHub: `https://github.com/derek-suwho/Whitehelmet`
- License: ISC
