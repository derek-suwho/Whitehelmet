---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (vanilla JS + Node.js, no build pipeline — curl + manual browser checks) |
| **Config file** | none |
| **Quick run command** | `curl -s http://localhost:3000/api/health` |
| **Full suite command** | Manual checklist (all 10 rows in verification map below) |
| **Estimated runtime** | ~2 minutes (manual) |

---

## Sampling Rate

- **After every task commit:** Run `curl -s http://localhost:3000/api/health` (confirms server starts and API routes work)
- **After every plan wave:** Run full manual checklist — all 10 verification rows
- **Before `/gsd:verify-work`:** Full checklist must pass
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| GET /api/health | 01 | 1 | INFRA-01 | smoke | `curl -s http://localhost:3000/api/health` | ❌ Wave 0 | ⬜ pending |
| POST /api/templates | 01 | 1 | INFRA-01 | smoke | `curl -s -X POST -H 'Content-Type: application/json' -d '{"name":"test"}' http://localhost:3000/api/templates && ls Whitehelmet/data/templates/` | ❌ Wave 0 | ⬜ pending |
| GET /api/templates | 01 | 1 | INFRA-01 | smoke | `curl -s http://localhost:3000/api/templates` | ❌ Wave 0 | ⬜ pending |
| JSON on disk (content) | 01 | 1 | INFRA-02 | smoke | `ls -la Whitehelmet/data/templates/` after POST | ❌ Wave 0 | ⬜ pending |
| JSON content matches | 01 | 1 | INFRA-02 | smoke | `cat Whitehelmet/data/templates/*.json` | ❌ Wave 0 | ⬜ pending |
| Page loads clean | 01 | 1 | INFRA-03 | manual | Open browser devtools, load `http://localhost:3000`, check for console errors | ❌ Wave 0 | ⬜ pending |
| Three panels render | 01 | 1 | INFRA-03 | manual | Visual inspection — Sources, Excel Editor, AI Chat all visible | ❌ Wave 0 | ⬜ pending |
| Role switcher visible | 01 | 1 | ROLE-01 | manual | Visual inspection in top bar | ❌ Wave 0 | ⬜ pending |
| Role switcher changes data-role | 01 | 1 | ROLE-01 | smoke | Browser devtools: `document.body.dataset.role` after switching | ❌ Wave 0 | ⬜ pending |
| Each role shows distinct view | 01 | 1 | ROLE-02 | manual | Cycle through all 4 roles, verify panel/action visibility changes | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No existing test infrastructure. Phase 1 introduces no test runner — all validation is curl smoke tests + browser manual checks.

- [ ] Server must be running: `cd Whitehelmet && node serve.mjs`
- [ ] Verify `data/` directory is created on first API call
- [ ] No test files to create — smoke tests are run ad-hoc via curl

*No test file stubs needed — manual curl + browser approach covers all requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Page loads without console errors | INFRA-03 | Browser DevTools required | Open `http://localhost:3000`, check Console tab for errors |
| All three panels render correctly | INFRA-03 | Visual layout check | Confirm Sources (left), Excel Editor (center), AI Chat (right) all visible |
| Role switcher visible in top bar | ROLE-01 | Visual UI check | Confirm dropdown/select in top-right area of header |
| Each role shows distinct panel config | ROLE-02 | Behavioral UI check | Cycle Contractor → PM → Admin → Director; confirm each shows different panels/actions |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
