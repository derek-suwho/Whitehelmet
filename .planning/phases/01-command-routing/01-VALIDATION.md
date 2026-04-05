---
phase: 1
slug: command-routing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — vanilla JS, browser environment; manual testing only |
| **Config file** | none |
| **Quick run command** | `node serve.mjs` then open http://localhost:3000 |
| **Full suite command** | Manual walkthrough (see Manual-Only Verifications below) |
| **Estimated runtime** | ~3 minutes manual walkthrough |

---

## Sampling Rate

- **After every task commit:** Open browser and verify the specific behavior implemented
- **After every plan wave:** Run full manual walkthrough
- **Before `/gsd:verify-work`:** All manual verifications must pass

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | ROUTE-01 | manual | open browser, check handler registered | N/A | ⬜ pending |
| 1-01-02 | 01 | 1 | ROUTE-02, ROUTE-03 | manual | type command → true; type non-command → false | N/A | ⬜ pending |
| 1-01-03 | 01 | 1 | PARSE-01, PARSE-02 | manual | check Network tab for API call + JSON response | N/A | ⬜ pending |
| 1-01-04 | 01 | 1 | PARSE-03 | manual | type ambiguous command → error in chat | N/A | ⬜ pending |
| 1-01-05 | 01 | 1 | UX-03 | manual | type command → see `...` bubble appear before response | N/A | ⬜ pending |
| 1-01-06 | 01 | 2 | TMPL-01 | manual | type "add a Total column" → column appears in grid | N/A | ⬜ pending |
| 1-01-07 | 01 | 2 | TMPL-02 | manual | type "remove the Amount column" → column gone | N/A | ⬜ pending |
| 1-01-08 | 01 | 2 | TMPL-03 | manual | type "rename Status to Payment Status" → header updates | N/A | ⬜ pending |
| 1-01-09 | 01 | 2 | TMPL-04 | manual | type "apply formula =A{row}+B{row} to Total" → formula in cells | N/A | ⬜ pending |
| 1-01-10 | 01 | 2 | UX-01 | manual | confirmation message appears in chat after each op | N/A | ⬜ pending |
| 1-01-11 | 01 | 2 | UX-02 | manual | error message when column name not found | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No test framework to install — vanilla JS browser app with no test runner. All verification is manual.

*Existing infrastructure covers all phase requirements (manual testing only).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Handler intercepts spreadsheet commands | ROUTE-01, ROUTE-02 | Browser JS, no test runner | Load app, open spreadsheet, type "add a Total column" → should NOT go to normal chat |
| Non-commands fall through | ROUTE-03 | Browser JS | Type "what's the weather" → should reach normal chat AI |
| Thinking indicator appears | UX-03 | Browser DOM timing | Type command → verify `...` bubble appears before response |
| Add column by name | TMPL-01 | Spreadsheet DOM | Type "add a column called Total" → verify new column header in grid |
| Remove column by name | TMPL-02 | Spreadsheet DOM | Type "remove the [header] column" → verify column gone |
| Rename column | TMPL-03 | Spreadsheet DOM | Type "rename [old] to [new]" → verify header text changes |
| Formula applied to column | TMPL-04 | Spreadsheet DOM | Type formula command → verify formula strings in cells |
| Unknown column error | UX-02 | Browser UI | Type "remove column XYZ" (nonexistent) → error message in chat |
| No spreadsheet open | ROUTE-03 | Browser state | Close spreadsheet, type command → falls through to normal chat |

---

## Validation Sign-Off

- [ ] All tasks have manual verification steps
- [ ] Sampling continuity: verify after each task commit in browser
- [ ] No automated framework needed (browser-only app)
- [ ] `nyquist_compliant: true` set in frontmatter after verification

**Approval:** pending
