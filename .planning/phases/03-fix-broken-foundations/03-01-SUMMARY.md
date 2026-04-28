---
phase: 03-fix-broken-foundations
plan: 01
subsystem: api
tags: [anthropic, openai-format, consolidation, jspreadsheet, xlsx]

# Dependency graph
requires:
  - phase: 02-row-and-data-operations
    provides: filter_rows using hideRow — show_all_rows complements it with showRow
provides:
  - consolidation.js calling /api/chat with OpenAI message format (no more 401)
  - Construction-aware SYSTEM_PROMPT with column normalization for subcontractor reports
  - show_all_rows op resetting filters via showRow loop
  - export op triggering #download-xlsx-btn click
affects:
  - phase 4 (data-awareness): consolidation now outputs normalized columns; snapshot helper should expect Source File column
  - phase 5 (master-records): export op enables one-click xlsx save from any spreadsheet

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Backend proxy pattern: all Anthropic calls go through /api/chat with OpenAI message format (role:system + role:user)"
    - "Filter complement pattern: hideRow (filter_rows) paired with showRow loop (show_all_rows) for non-destructive filtering"
    - "DOM trigger pattern: export op delegates to existing #download-xlsx-btn rather than duplicating xlsx generation logic"

key-files:
  created: []
  modified:
    - js/consolidation.js
    - js/ai-operations.js

key-decisions:
  - "consolidation.js uses /api/chat with OpenAI message format — consistent with how ai-operations.js already calls the backend"
  - "SYSTEM_PROMPT includes Source File as first column so PMs can always trace merged rows back to origin file"
  - "show_all_rows calls showRow on every row index — simpler and safer than tracking which rows were hidden"
  - "export clicks #download-xlsx-btn rather than re-implementing xlsx generation — avoids duplication and stays in sync with excel-editor.js"

patterns-established:
  - "All Anthropic calls go through /api/chat — direct API calls with x-api-key header are forbidden"
  - "New ops require both: a case in executeOp switch AND a shape + hint in SYSTEM_PROMPT"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-04-09
---

# Phase 3 Plan 01: Fix Broken Foundations Summary

**consolidation.js 401 fixed via /api/chat proxy with construction-aware column normalization; show_all_rows and export ops added to ai-operations.js**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-09T19:42:21Z
- **Completed:** 2026-04-09T19:44:26Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Fixed consolidation 401 error by switching from direct Anthropic API to /api/chat proxy using OpenAI message format
- Replaced generic consolidation prompt with construction-aware version: normalizes 6 column name families (Invoice Amount, PO Number, Subcontractor, Payment Status, Description, Date), adds Source File column, preserves all duplicate rows
- Added show_all_rows op that clears active filters by calling showRow on every row index — complements the existing filter_rows hideRow approach
- Added export op that triggers the existing #download-xlsx-btn so users can download the spreadsheet as .xlsx from chat

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix consolidation.js — switch to /api/chat and make prompt construction-aware** - `81ff7e6` (fix)
2. **Task 2: Add show_all_rows and export ops to ai-operations.js** - `41a4742` (feat)

## Files Created/Modified
- `js/consolidation.js` - Switched fetch target to /api/chat, OpenAI message format, updated response parsing, replaced SYSTEM_PROMPT with construction-aware version
- `js/ai-operations.js` - Added show_all_rows case (showRow loop), export case (download button click), extended SYSTEM_PROMPT with op shapes and natural language hints

## Decisions Made
- consolidation.js now uses /api/chat with OpenAI format (consistent with ai-operations.js pattern established in phase 1)
- Source File is the first column in merged output so PMs can always trace rows back to origin
- show_all_rows iterates all rows unconditionally rather than tracking hidden rows — simpler and handles edge cases
- export delegates to #download-xlsx-btn click rather than re-implementing xlsx generation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Consolidation is now unblocked and functional end-to-end
- All 10 ops (8 existing + show_all_rows + export) are active
- Phase 4 (Data Awareness) can proceed: spreadsheet snapshot helper and data-aware chat/command parsing

---
*Phase: 03-fix-broken-foundations*
*Completed: 2026-04-09*
