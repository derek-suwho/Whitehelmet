# Phase 1: Foundation - Research

**Researched:** 2026-03-10
**Domain:** Node.js HTTP API extension, vanilla JS role-based UI, JSON file persistence
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Node.js backend API endpoints handle template storage, report submission, and consolidation | serve.mjs extension pattern; Node.js `http` module routing; `fs.writeFile` for JSON persistence |
| INFRA-02 | Data persisted as JSON files on disk (no database required) | Node.js `fs/promises` API; directory structure design; atomic write pattern |
| INFRA-03 | Existing three-panel UI shell extended to support reporting workflows | index.html anatomy (lines 540–739); panel class system; safe insertion points in the DOM |
| ROLE-01 | UI provides a role switcher to toggle between Contractor, PM, System Admin, and Project Director views | CSS `display:none` toggle pattern; `data-role` attribute pattern; existing top-bar right slot |
| ROLE-02 | Each role sees only the panels/actions relevant to their workflow | Role-to-panel visibility matrix; CSS class toggling; no server involvement needed |
</phase_requirements>

---

## Summary

Phase 1 converts a static single-page prototype into a functional client-server application. There are two independent workstreams: (1) extending `serve.mjs` from a pure static server into a minimal REST API server, and (2) grafting a role switcher onto `index.html` without breaking the three-panel layout that currently works.

The tech stack decisions are fully locked: vanilla JavaScript, Node.js built-in `http` module, and JSON files on disk. There are no external dependencies to add for Phase 1. The entire server-side API can be built using only `http`, `fs/promises`, and `path` — all built into Node.js 24. The client-side role switcher requires only DOM manipulation: `classList`, `dataset`, and `document.querySelectorAll`.

The primary risk in this phase is the monolithic `index.html` file. At 739 lines with tightly coupled CSS grid layout, any HTML insertion or CSS addition must be carefully scoped. The role switcher must be added to the existing `top-bar` right slot (line 531–538) — which is already a flex container with `gap:16px` — without touching the `.panels-container` grid. Role-based panel visibility should be implemented purely with CSS class toggling on a root element (`data-role` on `<body>` or `.app-shell`) rather than per-element `display` manipulation.

**Primary recommendation:** Add an API routing layer to the top of `serve.mjs` (before the static file fallback), create a `data/` directory for JSON persistence alongside the app, and implement the role switcher as a `<select>` element in the existing top-bar with a single JS event listener that sets `document.body.dataset.role` and uses CSS attribute selectors to control visibility.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:http` | built-in (Node 24) | HTTP server and request routing | Already used in serve.mjs; no dependencies; sufficient for simple REST API |
| `node:fs/promises` | built-in (Node 24) | Async JSON file reads and writes | Promise-based API avoids callback hell; already available |
| `node:path` | built-in (Node 24) | Path construction for data directories | Already imported in serve.mjs |
| `node:url` | built-in (Node 24) | `fileURLToPath` for `__dirname` in ESM | Already used in serve.mjs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `URL` (global) | built-in | Parse query strings from `req.url` | When API routes need URL parameters |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:http` routing by hand | Express.js | Express is cleaner but adds a dependency and contradicts the no-framework decision |
| JSON files with `fs.writeFile` | SQLite via `better-sqlite3` | SQLite is more robust but explicitly out of scope per project decisions |
| CSS class toggling for roles | A JS state object / reactive framework | Framework adds build pipeline; pure CSS attribute selectors are sufficient |

**Installation:** No new packages required for Phase 1.

---

## Architecture Patterns

### Recommended Data Directory Structure
```
Whitehelmet/
├── serve.mjs          # Extended: static + API routes
├── index.html         # Extended: + role switcher in top-bar
├── data/              # NEW: all JSON persistence
│   ├── templates/     # template JSON files (Phase 2 writes here)
│   └── reports/       # submitted report JSON files (Phase 3 writes here)
└── package.json
```

The `data/` directory lives inside `Whitehelmet/` alongside the app. This keeps it self-contained and reachable from `serve.mjs` using `path.join(__dirname, 'data', ...)` without any path resolution complexity.

### Pattern 1: Request Router at Top of serve.mjs

**What:** Before the existing static file handler, check `req.method` and `req.url` for API routes. If matched, handle and return. If not matched, fall through to the existing static handler.

**When to use:** The existing static handler should remain completely unchanged. The API layer sits above it as a conditional early-return guard.

**Example:**
```javascript
// serve.mjs — top of createServer callback, BEFORE the existing fs.readFile block
const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  // API routes — handled first, static fallback below
  if (urlPath.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    try {
      await handleApiRequest(req, res, urlPath);
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
    return;  // <-- critical: prevents falling through to static handler
  }

  // Existing static file logic unchanged below this point
  // ...
});
```

### Pattern 2: Reading JSON Body from POST Request

**What:** Node.js `http` does not automatically parse request bodies. For POST endpoints that receive JSON, collect the body chunks manually.

**Example:**
```javascript
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}
```

### Pattern 3: Safe JSON File Write

**What:** Write JSON to disk atomically — write to a temp file then rename — to avoid corrupt data if the process crashes mid-write. For MVP with single-user local use, a direct `writeFile` is acceptable, but using a consistent pattern now avoids rewrites later.

**Example:**
```javascript
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

async function writeJsonFile(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}
```

The `mkdir` with `{ recursive: true }` ensures the directory exists without throwing if it already does. This is the correct pattern — do NOT check for directory existence before creating.

### Pattern 4: Role Switcher via CSS Attribute Selector

**What:** Set `data-role` on `<body>`. CSS rules using `[data-role="contractor"] .pm-only { display:none }` control visibility declaratively without per-element JS.

**When to use:** Any time panel sections, buttons, or UI regions need to show/hide based on role.

**Example (CSS to add inside `<style>` block in index.html):**
```css
/* Default: show everything */
.role-contractor,
.role-pm,
.role-admin,
.role-director { display: none; }

/* Show only what the active role needs */
body[data-role="contractor"] .role-contractor { display: flex; }
body[data-role="pm"]         .role-pm         { display: flex; }
body[data-role="admin"]      .role-admin       { display: flex; }
body[data-role="director"]   .role-director    { display: flex; }

/* Panels that are hidden for certain roles */
body[data-role="contractor"] .panel-chat { display: none; }
```

**Example (JS to add at bottom of `<script>` block in index.html):**
```javascript
var roleSelect = document.getElementById('roleSwitcher');
roleSelect.addEventListener('change', function () {
  document.body.dataset.role = this.value;
});
// Set default role on load
document.body.dataset.role = roleSelect.value;
```

### Pattern 5: Role Switcher HTML Placement

**What:** The top-bar right section (lines 531–538 in index.html) is already a flex container. Insert the `<select>` element inside it.

**Where exactly:** Inside the `<div style="display:flex; align-items:center; gap:16px;">` at line 531, before the `<span class="badge-amber">v0.1</span>`.

**Example:**
```html
<select id="roleSwitcher" style="
  background: #354259;
  color: #cdd6e4;
  border: 1px solid #3d4e6a;
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
">
  <option value="contractor">Contractor</option>
  <option value="pm">Project Manager</option>
  <option value="admin">System Admin</option>
  <option value="director">Project Director</option>
</select>
```

### API Endpoint Design (Phase 1 skeleton only)

Phase 1 must establish the API infrastructure that Phase 2 and Phase 3 will fill. The endpoints do not need full logic in Phase 1 — they need correct routing, JSON I/O, and directory creation. Recommended surface area for Phase 1:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Confirms server is running as API server, not just static |
| GET | `/api/templates` | Returns `[]` or reads `data/templates/` directory listing |
| POST | `/api/templates` | Accepts JSON body, writes to `data/templates/{id}.json` |
| GET | `/api/reports` | Returns `[]` or reads `data/reports/` directory listing |
| POST | `/api/reports` | Accepts JSON body, writes to `data/reports/{id}.json` |

This matches INFRA-01's requirement that "endpoints handle template storage and report submission." Consolidation endpoints belong to Phase 4.

### Anti-Patterns to Avoid

- **Don't touch the `.panels-container` grid template.** The `grid-template-columns: 280px 1fr 320px` is the load-bearing structure. Role visibility should use `display:none` on panel contents or overlay elements, not column removal.
- **Don't use `innerHTML` with user-provided strings.** The XSS concern is documented in CONCERNS.md. Use `textContent` for any user-derived text rendered into the DOM.
- **Don't parse `req.url` with string splits for complex routing.** Use `new URL(req.url, 'http://localhost')` to correctly handle query strings and paths.
- **Don't create `data/` directory in a one-time setup script.** Create it on-demand in `handleApiRequest` using `mkdir({ recursive: true })`. This is more robust across clean checkouts.
- **Don't make the static file handler `async`.** The existing callback-based `fs.readFile` works fine; only the new API routes need `async`. Converting the whole handler would require careful error handling audit.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP body parsing for JSON POST | Custom stream accumulator from scratch | The `readJsonBody` pattern above (standard Node.js streams) | It's 8 lines; the pattern is well-established; do not reach for a parser library |
| Directory creation for data files | `if (!exists) mkdir()` check-then-create | `mkdir(dir, { recursive: true })` | Race condition between check and create; `recursive:true` is idempotent |
| Role visibility toggling | Per-element `style.display` in JS | CSS `[data-role]` attribute selectors | JS per-element toggling breaks when new elements are added; CSS is declarative and automatic |
| Unique report/template IDs | Rolling integer counters stored in a file | `Date.now()` or `crypto.randomUUID()` | `crypto.randomUUID()` is built into Node.js 14.17+ (running Node 24); no collision risk; no counter state to manage |

**Key insight:** The entire Phase 1 backend can be built with zero new npm packages. Everything needed is in Node.js built-ins.

---

## Common Pitfalls

### Pitfall 1: Callback-to-Async Mismatch in serve.mjs

**What goes wrong:** The existing `server.listen` callback uses `fs.readFile` (callback-based). If the new API handler is added as `async` but the server callback is not declared `async`, `await` inside it silently becomes a no-op and unhandled promise rejections occur.

**Why it happens:** The `http.createServer` callback is not natively async-aware. Errors in async handlers are swallowed unless you add a `.catch()`.

**How to avoid:** Declare the `createServer` callback as `async` and wrap the entire body in a try-catch, OR keep the server callback synchronous and call an internal `async function handleApiRequest(...)` that you `.catch()` inline.

**Warning signs:** API routes appear to succeed (200 response) but no file is written; or server crashes with `UnhandledPromiseRejection`.

### Pitfall 2: CSS Specificity Collision with Role Visibility

**What goes wrong:** Adding `display:none` to `.panel-chat` for certain roles conflicts with the existing `.panel` rule that sets `display:flex`. The more-specific selector wins, but the order matters.

**Why it happens:** Tailwind CDN resets and the inline `<style>` block both have rules on `.panel`. A new `[data-role]` rule may have lower specificity than an existing inline style.

**How to avoid:** Place all role visibility CSS **after** the existing `<style>` block content, so cascade order is correct. If specificity conflict occurs, add `!important` to the `display:none` rule only.

**Warning signs:** Role switcher changes value but panels don't hide/show.

### Pitfall 3: Breaking the CSS Grid Layout When Adding Role-Based Content

**What goes wrong:** Adding new `<aside>` or `<section>` elements as direct children of `.panels-container` causes the grid to add unexpected columns, breaking the three-panel layout.

**Why it happens:** CSS Grid auto-places any direct child into a grid cell. Adding a fourth direct child creates a fourth column (or wraps unexpectedly).

**How to avoid:** Any new role-specific panels or content should be placed **inside** existing panel `.panel-body` elements, not as siblings to `.panel-sources`, `.panel-excel`, `.panel-chat`. Use conditional content within each panel's body.

**Warning signs:** Layout wraps or panels compress/expand unexpectedly after adding new HTML.

### Pitfall 4: CORS Errors When Frontend Fetches the API

**What goes wrong:** The browser fetches `http://localhost:3000/api/...` from the same origin, so no CORS issue. But if the port differs (e.g., a future dev proxy), requests fail with CORS blocked.

**Why it happens:** Missing `Access-Control-Allow-Origin` header.

**How to avoid:** Add CORS headers to all API responses from the start: `res.setHeader('Access-Control-Allow-Origin', '*')`. It costs nothing for a local dev tool.

**Warning signs:** Browser console shows `CORS policy: No 'Access-Control-Allow-Origin' header`.

### Pitfall 5: Serving `data/` JSON Files as Static Assets

**What goes wrong:** `serve.mjs` currently serves ALL files under `__dirname`. A request for `/data/templates/foo.json` bypasses the API and reads the file directly via the static handler.

**Why it happens:** The static file handler resolves any path that exists on disk.

**How to avoid:** Add a guard in the static handler: if `urlPath.startsWith('/data/')`, respond with 403. This forces all data access through the API layer.

**Warning signs:** Client-side JS can `fetch('/data/templates/foo.json')` and get raw file contents, bypassing any future server-side validation.

### Pitfall 6: index.html Becomes Unmanageable Mid-Phase

**What goes wrong:** Adding role-switcher HTML, role-visibility CSS, and JS all to the monolithic file means 3 separate insertion points that must stay in sync during development.

**Why it happens:** No module system, no component boundaries.

**How to avoid:** Make all three additions in the same plan/task. Document the exact line numbers where each insertion lands. The structure is: CSS goes in `<style>` block (before `</style>`), HTML goes in `.top-bar` right div (line ~531), JS goes at the bottom of the `<script>` block (before the closing `</script>`).

---

## Code Examples

Verified patterns from Node.js built-in documentation (Node.js 24):

### API Route Handler Skeleton
```javascript
// Source: Node.js 24 http module docs — createServer pattern
async function handleApiRequest(req, res, urlPath) {
  const { method } = req;

  if (urlPath === '/api/health' && method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (urlPath === '/api/templates' && method === 'GET') {
    const dir = path.join(__dirname, 'data', 'templates');
    await mkdir(dir, { recursive: true });
    const files = await readdir(dir);
    const templates = await Promise.all(
      files.filter(f => f.endsWith('.json')).map(async f => {
        const content = await readFile(path.join(dir, f), 'utf8');
        return JSON.parse(content);
      })
    );
    res.writeHead(200);
    res.end(JSON.stringify(templates));
    return;
  }

  if (urlPath === '/api/templates' && method === 'POST') {
    const body = await readJsonBody(req);
    const id = crypto.randomUUID();
    const filePath = path.join(__dirname, 'data', 'templates', `${id}.json`);
    await writeJsonFile(filePath, { id, ...body });
    res.writeHead(201);
    res.end(JSON.stringify({ id }));
    return;
  }

  // 404 for unrecognized API routes
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
}
```

### ES Module Imports to Add at Top of serve.mjs
```javascript
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import crypto from 'node:crypto';
```

Note: `crypto.randomUUID()` is available in Node.js 14.17.0+. Running Node 24.10.0 — confirmed available.

### fetch() Call from index.html Client-Side JS
```javascript
// Source: MDN Fetch API — standard browser fetch
async function fetchTemplates() {
  const res = await fetch('/api/templates');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function submitTemplate(data) {
  const res = await fetch('/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

The `fetch` API is available in all modern browsers without polyfilling. No library needed.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `fs.readFile` callback for async file I/O | `fs/promises` with async/await | Node.js 10 (stable 12+) | Cleaner error handling; no callback pyramid |
| `require()` for imports | `import` / ES Modules | Node.js 12+ (stable 14+) | Already used in serve.mjs; consistent throughout |
| `Math.random()` for unique IDs | `crypto.randomUUID()` | Node.js 14.17+ | Cryptographically secure; no collision risk |
| Manual `mkdir` existence checks | `mkdir(path, { recursive: true })` | Node.js 10.12+ | Idempotent; eliminates TOCTOU race condition |

**Deprecated/outdated:**
- `fs.existsSync()` before `mkdir`: Do not use — prefer `{ recursive: true }` flag.
- `var` declarations in new JS: The existing `index.html` uses `var` (appropriate since it's a legacy-compat IIFE). New code in the same `<script>` should match `var` for consistency. New `.mjs` files should use `const`/`let`.

---

## Open Questions

1. **Should the role switcher persist across page refreshes?**
   - What we know: No auth, no session storage requirements stated.
   - What's unclear: Whether `localStorage.setItem('role', value)` is desired or if resetting to Contractor on refresh is acceptable.
   - Recommendation: Default to no persistence in Phase 1 (always starts as Contractor). Add `localStorage` persistence only if the user reports friction during review.

2. **What panel layout does each role see?**
   - What we know: ROLE-02 says "distinct, appropriate view." The roles are Contractor, PM, Admin, Director.
   - What's unclear: Exact panel-level visibility matrix is not specified in requirements.
   - Recommendation (for planner to formalize): Contractor sees Sources + Excel Editor + Chat; PM sees Excel Editor + Chat (read-only master record view later); Admin sees Sources + Excel Editor (template management later); Director sees Excel Editor only (summary view later). The Sources panel with file drop-zone is Contractor/Admin relevant. Chat panel is universal. This is a discretion call — document it in the plan.

3. **How should the `data/` directory be initialized?**
   - What we know: No setup script exists; `serve.mjs` starts with `node serve.mjs`.
   - What's unclear: Should the server create `data/templates/` and `data/reports/` on startup, or lazily on first request?
   - Recommendation: Lazy creation per endpoint using `mkdir({ recursive: true })` before each read/write. No separate initialization step needed.

---

## Validation Architecture

> nyquist_validation is enabled per config.json.

### Test Framework

No test framework exists in this project. This is a vanilla JS + Node.js project with no build pipeline. The recommended approach for Phase 1 validation is **manual smoke tests via curl and browser**, documented as runnable commands. No automated test runner is appropriate to introduce in this phase given the no-build-pipeline constraint.

| Property | Value |
|----------|-------|
| Framework | None (no test suite — see Wave 0 Gaps) |
| Config file | None |
| Quick run command | `curl http://localhost:3000/api/health` |
| Full suite command | Manual checklist below |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | GET /api/health returns `{"status":"ok"}` | smoke | `curl -s http://localhost:3000/api/health` | ❌ Wave 0 |
| INFRA-01 | POST /api/templates persists JSON to disk | smoke | `curl -s -X POST -H 'Content-Type: application/json' -d '{"name":"test"}' http://localhost:3000/api/templates && ls Whitehelmet/data/templates/` | ❌ Wave 0 |
| INFRA-01 | GET /api/templates returns array | smoke | `curl -s http://localhost:3000/api/templates` | ❌ Wave 0 |
| INFRA-02 | JSON file appears on disk after POST | smoke | `ls -la Whitehelmet/data/templates/` after POST | ❌ Wave 0 |
| INFRA-02 | JSON file content matches submitted body | smoke | `cat Whitehelmet/data/templates/*.json` | ❌ Wave 0 |
| INFRA-03 | Page loads without console errors | manual | Open browser devtools, load `http://localhost:3000` | ❌ Wave 0 |
| INFRA-03 | All three panels render correctly | manual | Visual inspection in browser | ❌ Wave 0 |
| ROLE-01 | Role switcher visible in top bar | manual | Visual inspection | ❌ Wave 0 |
| ROLE-01 | Switching role changes `data-role` attribute | smoke | Browser devtools: `document.body.dataset.role` after switch | ❌ Wave 0 |
| ROLE-02 | Each role shows distinct panel configuration | manual | Cycle through all 4 roles and verify panel visibility | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `curl -s http://localhost:3000/api/health` (confirms server starts and routes API)
- **Per wave merge:** Full manual checklist — all 10 rows above
- **Phase gate:** All manual checks pass before `/gsd:verify-work`

### Wave 0 Gaps

No existing test infrastructure. Phase 1 introduces no test runner — validation is entirely smoke tests via `curl` and browser manual checks.

- [ ] Start server manually: `cd Whitehelmet && node serve.mjs` — required before any curl commands
- [ ] Verify `data/` directory created on first API call
- [ ] No existing test files to create — smoke tests are run ad-hoc

*(All validation for this phase is manual or curl-based — no test file creation needed in Wave 0.)*

---

## Sources

### Primary (HIGH confidence)
- Node.js 24 official docs (`node:http`, `node:fs/promises`, `node:crypto`) — createServer pattern, readdir, writeFile, randomUUID
- Direct code inspection of `/Users/artemd/Desktop/whitehelmet/Whitehelmet/serve.mjs` — exact structure of existing static server
- Direct code inspection of `/Users/artemd/Desktop/whitehelmet/Whitehelmet/index.html` — exact line numbers for insertion points, existing CSS class names, existing JS structure

### Secondary (MEDIUM confidence)
- MDN Web Docs — `fetch()` API usage in vanilla JS browser context
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md` — locked decisions and constraints

### Tertiary (LOW confidence)
- None — all findings for Phase 1 derive from direct code inspection and Node.js built-in documentation, which is HIGH confidence.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — entire Phase 1 uses Node.js built-ins already present in serve.mjs; no new libraries
- Architecture: HIGH — based on direct code inspection of serve.mjs and index.html; no speculation required
- Pitfalls: HIGH — derived from direct analysis of existing code structure (CONCERNS.md + code inspection) and established Node.js patterns
- Role visibility patterns: HIGH — CSS attribute selectors are a well-established, stable browser feature

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable tech — Node.js built-ins and CSS attribute selectors don't change)
