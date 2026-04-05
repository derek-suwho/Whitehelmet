# Phase 4: Dashboard Interaction — Design Spec

**Date:** 2026-03-31
**Project:** Whitehelmet — Group 2 Frontend
**Files owned:** `js/master-records.js`, `css/master-records.css`
**Do not touch:** `js/state.js`, `js/app.js`, `index.html`, and all other group files

---

## Overview

Phase 4 adds dashboard-level interactions that are missing after Phase 3: column sorting (Name and Last Updated), a dynamic record count label, and Escape-to-close. All changes stay inside `js/master-records.js` and `css/master-records.css`.

---

## Sort State & Behavior

Two closure variables added inside `initMasterRecords()`, before any function declarations:

```js
var currentSortCol = 'savedAt';  // default: Last Updated
var currentSortDir = 'desc';     // default: newest first
```

**Sort function** — `sortRecords(records)` sorts a shallow copy of the array (never mutates the source):
- `'savedAt'` → lexicographic ISO 8601 string compare (correct for date ordering)
- `'name'` → case-insensitive string compare (`localeCompare`)
- Returns sorted copy in `currentSortDir` order (`'asc'` or `'desc'`)

**Click behavior:**
- Clicking the active column toggles `currentSortDir` between `'asc'` and `'desc'`
- Clicking an inactive sortable column sets `currentSortCol` to that column and resets `currentSortDir` to `'asc'`
- After updating state, re-renders with in-memory records (no re-fetch)

**Composition with search:** Sort runs first inside both `render()` and `filterAndRender()` (inside `buildSearch()`). The filtered results are always in the current sort order.

**Escape key:** A `keydown` listener on `document` closes the dashboard via `state.hideDashboard()` when `event.key === 'Escape'`. The listener is added when `state.showDashboard` is called and removed when `state.hideDashboard` is called. A named function reference (`var escHandler = function(e) {...}`) must be used so `removeEventListener` removes the correct handler. `hideDashboard` must always call `removeEventListener` before reassigning `escHandler` to prevent stacking if `showDashboard` is called multiple times.

---

## Column Header Rendering

`buildTableHeader()` is updated to accept the current records array and wire click handlers on sortable columns.

**Sortable columns:** Name (`'name'`), Last Updated (`'savedAt'`) only.

**Visual indicators (arrow spans):**
- Active column, ascending → `↑` in primary color `#e8ecf2`
- Active column, descending → `↓` in primary color `#e8ecf2`
- Inactive sortable column → `↕` in muted color `#55627a` (indicates sortability)

**Styling:**
- Sortable `<th>` gets `cursor: pointer` via `.db-th-sortable` CSS class
- Active column header text color `#e8ecf2` via `.db-th-active` CSS class (overrides default `#8c99ae`)
- Hover: sortable header lightens slightly to `#8c99ae` on hover if inactive

**Re-render path:** Header click updates `currentSortCol`/`currentSortDir`, then calls `render(lastFetchedRecords)` where `lastFetchedRecords` is a closure variable holding the most recently fetched records array. No re-fetch needed.

---

## Record Count Label

A `<div class="db-record-count">` rendered between the search bar and the `db-table-area`.

**Content:**
- No search active: `"5 records"` (total count)
- Search active with results: `"Showing 2 of 5 records"`
- Zero filtered results: element hidden (search-empty state message is sufficient)

**Updates:** The count element is created in `render()` and updated in-place by `filterAndRender()` inside `buildSearch()`.

**Styling:** `font-size: 12px`, `color: #8c99ae`, sentence case (no `text-transform`), padding `8px 24px` to align with search bar and table.

---

## New Closure Variable

```js
var lastFetchedRecords = [];
```

Populated by `reloadRecords()` after a successful `apiAdapter.getAll()`. Used by sort header clicks to re-render without re-fetching.

---

## Constraints

- ES5 only: `var`, no arrow functions, no `let`/`const`
- No new `state.js` properties
- No changes to `index.html`
- All code stays inside `js/master-records.js` and `css/master-records.css`
