# TESTING.md

## Test Framework

**None configured.** `package.json` test script is a placeholder:
```json
"test": "echo \"Error: no test specified\" && exit 1"
```

No test files exist anywhere in the codebase.

---

## Current Testing Approach

All testing is manual:
1. Run `node serve.mjs` to start the dev server on port 3000
2. Open browser at `http://localhost:3000`
3. Interact with the UI manually
4. Use `node screenshot.mjs <url> [label]` to capture screenshots for visual verification

---

## Test Coverage

| Area | Coverage |
|------|----------|
| Unit tests | ✗ None |
| Integration tests | ✗ None |
| E2E tests | ✗ None |
| Visual regression | ✗ None (manual screenshots only) |
| Accessibility | ✗ None |

---

## Areas That Need Testing

Based on codebase analysis:

**Critical paths:**
- Navigation between sections (Home, Analytics, AI Chat, etc.)
- Tab switching within Analytics section
- Table/data rendering with sample data
- Chat message send/receive flow

**Async behavior:**
- Any fetch/async operations in the chat UI
- Screenshot tool URL loading + capture

**DOM state:**
- Active tab highlighting
- Sidebar expand/collapse
- Modal open/close behavior

---

## Recommended Test Stack

Given the vanilla JS + Node.js stack, suitable options:
- **Playwright** or **Puppeteer** — E2E browser tests (Puppeteer already a dependency)
- **Vitest** or **Jest** — Unit tests for any extracted logic
- No build tool currently, so tests would need to handle ES modules directly

---

## Notes

- The entire app is a single `index.html` file (739 lines), making unit testing of individual functions difficult without refactoring
- Puppeteer is already installed — E2E tests via `screenshot.mjs` pattern are the path of least resistance
- No CI/CD pipeline configured
