# Phase 3: Dashboard Renderer & Styling — Design Spec

**Date:** 2026-03-31
**Project:** Whitehelmet — Group 2 Frontend
**Files owned:** `js/master-records.js`, `css/master-records.css`
**Do not touch:** `js/state.js`, `js/app.js`, `index.html`, and all other group files

---

## Overview

Phase 3 implements the `render(records)` function inside `initMasterRecords()` and all associated CSS. It fills the `// Phase 3 will add: render(records)` placeholder left in `state.showDashboard`. The dashboard renders inside `#dashboard-root` as a full-screen fixed overlay.

---

## Layout & Structure

`#dashboard-root` is positioned `fixed; inset: 0` over the full viewport. Background `#0f1217`. Three stacked zones:

1. **Header** — sticky at top. Title "Master Records" (left) + prominent close button (right). Close calls `state.hideDashboard()`.
2. **Search bar** — directly below header, also sticky. Single text input filtering by `record.name`. Inline clear (✕) button. Sticky so it stays visible while table scrolls.
3. **Table area** — scrollable independently. Contains the records table, or one of the four states (loading, empty, error, search-empty).

---

## Table Columns

| Column | Data | Alignment | Width |
|--------|------|-----------|-------|
| Name | `record.name` | Left | Flexible (flex grow) |
| Last Updated | `record.savedAt` formatted "Mar 31, 2026" | Left | Fixed |
| Sources | `record.sourceCount` or `—` | Center | Fixed |
| Rows | `record.rowCount` or `—` | Center | Fixed |
| Cols | `record.colCount` or `—` | Center | Fixed |
| Open | Amber text button | Center | Fixed |
| Delete | Icon-only button | Center | Fixed |

**Name column behavior:**
- Truncated with ellipsis if too long; full name shown on `title` attribute hover
- Clicking the name (or anywhere on the row except delete) opens the record

**Open action:**
- Calls `state.openFile(record.fileObj)` then `state.hideDashboard()`
- Also triggered by clicking the row (except the delete button)
- Amber color `#e29a35`

**Delete action:**
- Icon-only button, default muted `#55627a`, turns red on hover
- Requires `confirm("Delete this record?")` before proceeding
- On confirm: calls `apiAdapter.remove(record.id)`, then re-renders with updated records array

**Table behavior:**
- Subtle row hover background for clarity
- `cursor: pointer` on hoverable rows
- Sticky column header row
- Comfortable row height (not cramped)
- Data resilience: all fields accessed safely — missing fields show `—`, missing `record.name` treated as empty string

---

## States (all rendered in the table content area)

**Loading**
- Simple CSS spinner (amber `#e29a35`) + "Loading records..." text
- Shown while `apiAdapter.getAll()` is in-flight

**Empty**
- Calm instructional message: "No saved consolidations yet. Consolidate files to create your first record."
- Shown when fetch succeeds and returns 0 records

**Error**
- Warning icon + "Failed to load records. Try again."
- Error color `#e05252`
- Prominent Retry button that re-calls the same fetch path used on initial load

**Search-empty**
- "No records match your search."
- Shown when filter reduces results to 0

---

## Search / Filter

- Client-side only — filters the already-fetched records array in memory
- Matches `record.name` case-insensitively via `indexOf`
- Missing `record.name` treated as empty string (never throws)
- Inline clear (✕) button resets filter and shows all records
- Simple `oninput` handler — no debounce needed at this scale

---

## Styling

Follows existing Whitehelmet dark theme:

| Token | Value | Usage |
|-------|-------|-------|
| `#0f1217` | Base background | Overlay background |
| `#171c23` | Elevated surface | Header, search bar background |
| `#1d242e` | Panel surface | Table header row |
| `#e29a35` | Amber accent | Open button, spinner, links |
| `#e8ecf2` | Primary text | Record name, column headers |
| `#8c99ae` | Secondary text | Date, metadata values |
| `#55627a` | Muted | Delete button default, placeholder |
| `#e05252` | Error red | Error state text, delete button hover |

All styles go in `css/master-records.css`. No changes to `css/styles.css`.

---

## Integration Points

- `render(records)` is defined inside `initMasterRecords()` closure — has direct access to `apiAdapter`, `state`, and `dashboardRoot`
- Called from `state.showDashboard()` after `apiAdapter.getAll()` resolves
- Also called internally after a successful delete to re-render the updated list
- `state.openFile` and `state.hideDashboard` are called on open
- `apiAdapter.remove(id)` is called on confirmed delete

---

## Constraints

- ES5 only: `var`, no arrow functions, no `let`/`const`
- No new state.js properties (Group 3 owns that file)
- No changes to `index.html`
- All code stays inside `js/master-records.js` and `css/master-records.css`
