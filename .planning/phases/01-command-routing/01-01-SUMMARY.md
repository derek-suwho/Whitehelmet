---
phase: 01-command-routing
plan: 01
subsystem: ai
tags: [anthropic, jspreadsheet, vanilla-js, chat, command-routing]

# Dependency graph
requires: []
provides:
  - state.chatCommandHandler registered and functional in js/ai-operations.js
  - parseCommand() calls Anthropic API and returns structured JSON op
  - executeOp() stub ready for Plan 02 column operation implementations
  - Thinking indicator bubble posted before API call, replaced or removed after
affects: [01-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Post thinking bubble via state.addMessage, then grab last .msg-bubble reference for in-place update"
    - "Return false from chatCommandHandler to pass non-commands through to normal chat"
    - "Single non-streaming Anthropic API call for intent classification and parameter extraction in one shot"

key-files:
  created: []
  modified: [js/ai-operations.js]

key-decisions:
  - "executeOp takes only op (not headers) as a parameter — headers not needed in stub; Plan 02 can add when implementing ops"
  - "Thinking bubble removed (parentElement.remove()) on non-command so no stale message lingers during normal chat response"

patterns-established:
  - "Thinking bubble pattern: addMessage('...','ai') then querySelectorAll('.msg-bubble')[last] for in-place replacement"
  - "chatCommandHandler guard: early return false when state.excelState.instance is null"

requirements-completed: [ROUTE-01, ROUTE-02, ROUTE-03, PARSE-01, PARSE-02, PARSE-03, UX-03]

# Metrics
duration: 5min
completed: 2026-03-31
---

# Phase 1 Plan 01: Command Routing Summary

**Anthropic API intent parser wired into chat handler with thinking bubble, JSON op dispatch stub, and non-command fall-through**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-01T02:47:05Z
- **Completed:** 2026-04-01T02:52:00Z
- **Tasks:** 1 of 2 auto tasks complete (Task 2 is human-verify checkpoint)
- **Files modified:** 1

## Accomplishments
- `initAiOperations()` registers `state.chatCommandHandler` — chat messages now route through the AI handler first
- `parseCommand()` calls Anthropic API with column headers and user text, returning a structured `{op, ...params}` JSON object
- `executeOp()` stub with switch on all four op types (`add_column`, `remove_column`, `rename_column`, `apply_formula`) ready for Plan 02
- Thinking bubble (`...`) appears immediately, is replaced with error/confirmation text or removed entirely for non-commands

## Task Commits

1. **Task 1: Implement command handler, API parser, and thinking indicator** - `26e9370` (feat)

**Plan metadata:** (docs commit — see final commit below)

## Files Created/Modified
- `js/ai-operations.js` — Full implementation replacing TODO stub: SYSTEM_PROMPT constant, parseCommand(), executeOp() stub, initAiOperations() with handler registration

## Decisions Made
- `executeOp(op)` takes only the op object (not headers) — the stub doesn't use headers, and Plan 02 will decide the exact signature when implementing real operations
- Thinking bubble removal uses `thinkingBubble.parentElement.remove()` to remove the whole wrapper div, matching the DOM structure `.msg.msg-ai > .msg-bubble`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused `headers` parameter from executeOp stub**
- **Found during:** Task 1 (IDE diagnostic after write)
- **Issue:** `executeOp(op, headers)` declared `headers` but never read — TS6133 lint hint would persist into Plan 02
- **Fix:** Changed signature to `executeOp(op)` and updated call site to `executeOp(op)`
- **Files modified:** js/ai-operations.js
- **Verification:** No further diagnostics; all plan verification checks still pass
- **Committed in:** 26e9370 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — unused parameter)
**Impact on plan:** Trivial cleanup with no behavior change. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. (API key is set via `state.apiKey` at runtime.)

## Next Phase Readiness
- Handler skeleton complete — Plan 02 fills in `executeOp` cases to actually mutate the spreadsheet
- Plan 02 can add `headers` back to `executeOp` signature when needed for column index lookups
- Task 2 (human-verify checkpoint) must be completed before marking plan 01 done

---
*Phase: 01-command-routing*
*Completed: 2026-03-31*
