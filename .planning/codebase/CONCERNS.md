# CONCERNS.md

## Technical Debt

### Monolithic HTML File
**File:** `Whitehelmet/index.html` (739 lines)
- All HTML, CSS (inline `<style>`), and JavaScript live in a single file
- No component separation, no build pipeline, no module splitting
- Makes navigation, testing, and parallel development difficult
- Grows increasingly unmanageable with each new feature

### DOM-Only State Management
- All application state lives in the DOM (active tab classes, displayed data)
- No state object, no reactive framework, no persistence
- State is lost on page refresh
- Makes debugging and testing complex

### Hardcoded User Paths
**File:** `Whitehelmet/screenshot.mjs`
- Chrome executable paths hardcoded for two specific users (`artemd`, `dereksu`)
- Breaks for any other developer immediately
- Should use `puppeteer.executablePath()` or environment variable

---

## Known Bugs / Issues

### Chat Scroll Timing
- Chat UI may have scroll-to-bottom timing issues after messages are appended (common pattern in DOM-only chat)
- No explicit scroll management observed

### Screenshot Silent Failure
- `screenshot.mjs` only tries two hardcoded Chrome paths; no fallback, no clear error if both fail
- `resolvedChrome` will be `undefined` and Puppeteer will silently use its default or throw cryptic error

### Missing File Upload Handlers
- UI appears to reference file upload functionality (based on product docs and Excel test data in `resources/`)
- No actual file upload or XLSX parsing implementation in `index.html`

---

## Security Concerns

### Unsanitized Input
- No evidence of input sanitization for chat messages or any form fields
- Risk of XSS if user input is ever rendered as `innerHTML`

### API Key Exposure
- If/when AI API integration is added, there is no env var pattern or secrets management in place
- Current `serve.mjs` serves all files in the directory — an `.env` file would be publicly accessible

### No CORS / Auth
- `serve.mjs` has no authentication, no CORS headers, no rate limiting
- Anyone on the local network can access the running server

---

## Performance Concerns

### Single Large HTML File
- Browser must parse 739 lines of HTML + inline styles + inline scripts before anything renders
- No lazy loading, no code splitting

### No Virtual Scrolling
- Data tables (e.g., Excel/KPI data displays) render all rows at once
- Will degrade with large datasets (1000+ rows)

### CDN Dependencies at Startup
- Tailwind CSS and Google Fonts are loaded from CDN on every page load
- No fallback if CDN is unavailable; no local caching strategy

---

## Fragile Areas

### CSS Grid Layout Coupling
- Layout structure tightly couples sidebar width, content area, and header height via CSS Grid
- Changes to one area likely break others without careful adjustment

### CDN Tailwind Config
- Tailwind is loaded via CDN `<script>`, which allows inline `tailwind.config` customization
- CDN version has limitations vs. PostCSS build (no JIT purging, larger bundle, version drift)

---

## Scaling Limits

- **Single user:** No concept of multiple users, sessions, or data isolation
- **In-memory only:** All data resets on page refresh — unsuitable for production use
- **No API layer:** Cannot be consumed by mobile apps or other clients
- **Monorepo gap:** `Whitehelmet/` subdirectory structure suggests future multi-package intent, but not realized

---

## Missing Infrastructure

| Item | Status |
|------|--------|
| Test suite | ✗ None |
| CI/CD pipeline | ✗ None |
| Linter / formatter | ✗ None |
| Environment variable management | ✗ None |
| Error monitoring | ✗ None |
| Logging | ✗ None |
| Build pipeline | ✗ None |
| Deployment configuration | ✗ None |

---

## Dependency Risks

| Dependency | Risk |
|------------|------|
| `puppeteer ^24.39.0` | Pinned to `^` — minor/patch updates auto-applied, major breakage possible |
| Tailwind CDN | Version not pinned in CDN URL — behavior could change |
| Google Fonts CDN | External availability dependency |
