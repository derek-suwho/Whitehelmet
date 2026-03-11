# INTEGRATIONS.md

## External Services

**None.** The application has no external API integrations, database connections, or auth providers.

All data is handled locally:
- State lives in browser memory (JavaScript variables + DOM)
- No backend persistence layer
- No network requests to external services at runtime

---

## CDN Dependencies (Frontend)

| Service | Resource | Usage |
|---------|----------|-------|
| Tailwind CSS CDN | `https://cdn.tailwindcss.com` | Utility CSS framework, loaded via `<script>` tag |
| Google Fonts | `https://fonts.googleapis.com` | Inter font family |
| Google Fonts CDN | `https://fonts.gstatic.com` | Font file delivery |

These are loaded in `Whitehelmet/index.html` `<head>`. No offline/build fallback.

---

## Dev Tooling

| Tool | Purpose | Notes |
|------|---------|-------|
| `serve.mjs` | Static file server | Node.js HTTP server on port 3000 |
| `screenshot.mjs` | Screenshot capture | Uses Puppeteer to screenshot a given URL |

`screenshot.mjs` has hardcoded Chrome executable paths for two specific users:
- `/Users/artemd/.cache/puppeteer/...`
- `/Users/dereksu/.cache/puppeteer/...`

This is a portability risk for other developers.

---

## File System Access

The app reads/writes local files indirectly:
- `screenshot.mjs` writes PNG files to `Whitehelmet/temporary screenshots/`
- `serve.mjs` reads files from the `Whitehelmet/` directory to serve them

No database, no cloud storage, no file upload API endpoints.

---

## Planned / Missing Integrations

Based on product docs in `resources/`:
- Excel/XLSX file parsing (`.xlsx` files present as test data but no parser in code)
- AI/LLM API integration (chat UI exists but no API calls wired up)
- Real data persistence (currently DOM-only state)
