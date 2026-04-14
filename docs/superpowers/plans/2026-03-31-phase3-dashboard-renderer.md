# Phase 3: Dashboard Renderer & Styling Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `render(records)` inside `initMasterRecords()` and all supporting CSS so the master records dashboard displays as a full-screen overlay with a searchable table, loading/empty/error states, and open/delete actions.

**Architecture:** All JS lives inside the `initMasterRecords()` closure in `js/master-records.js` — this gives every helper direct access to `apiAdapter`, `state`, and `dashboardRoot` without passing them around. CSS goes entirely in `css/master-records.css`. `state.showDashboard` is updated to show a loading state immediately, fetch records, and call `render(records)`.

**Tech Stack:** Vanilla JS (ES5 — `var` only, no arrow functions, no `let`/`const`), no build step, no test framework. Verification is manual in the browser via `node serve.mjs`.

---

## Chunk 1: CSS

### Task 1: Overlay, Header, and Search Bar Styles

**Files:**
- Modify: `css/master-records.css`

- [ ] **Step 1: Add overlay base styles**

Append to `css/master-records.css`:

```css
/* ── Dashboard Overlay ──────────────────────────────────── */
#dashboard-root {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: #0f1217;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
```

- [ ] **Step 2: Add header styles**

```css
/* ── Header ─────────────────────────────────────────────── */
.db-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: #171c23;
  border-bottom: 1px solid #1d242e;
  flex-shrink: 0;
}

.db-header-title {
  font-family: Georgia, Cambria, serif;
  font-size: 18px;
  color: #e8ecf2;
  margin: 0;
  font-weight: normal;
}

.db-close-btn {
  background: none;
  border: 1px solid #55627a;
  color: #8c99ae;
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: border-color 0.15s, color 0.15s;
}

.db-close-btn:hover {
  border-color: #e8ecf2;
  color: #e8ecf2;
}
```

- [ ] **Step 3: Add search bar styles**

```css
/* ── Search Bar ─────────────────────────────────────────── */
.db-search-bar {
  padding: 12px 24px;
  background: #171c23;
  border-bottom: 1px solid #1d242e;
  flex-shrink: 0;
  position: relative;
  display: flex;
  align-items: center;
}

.db-search-input {
  width: 100%;
  background: #0f1217;
  border: 1px solid #1d242e;
  border-radius: 4px;
  color: #e8ecf2;
  font-size: 13px;
  padding: 7px 32px 7px 10px;
  box-sizing: border-box;
  outline: none;
  font-family: inherit;
}

.db-search-input:focus {
  border-color: #55627a;
}

.db-search-input::placeholder {
  color: #55627a;
}

.db-search-clear {
  position: absolute;
  right: 32px;
  background: none;
  border: none;
  color: #55627a;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 4px;
  display: none;
}

.db-search-clear:hover {
  color: #8c99ae;
}
```

- [ ] **Step 4: Commit**

```bash
git add css/master-records.css
git commit -m "feat(03-01): add dashboard overlay, header, and search bar CSS"
```

---

### Task 2: Table, Row, Action Button, and State Styles

**Files:**
- Modify: `css/master-records.css`

- [ ] **Step 1: Add table area and table base styles**

```css
/* ── Table Area ─────────────────────────────────────────── */
.db-table-area {
  flex: 1;
  overflow-y: auto;
  padding: 0 24px 24px;
}

/* ── Table ──────────────────────────────────────────────── */
.db-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.db-table thead {
  position: sticky;
  top: 0;
  background: #1d242e;
  z-index: 1;
}

.db-table th {
  padding: 10px 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #8c99ae;
  text-align: left;
  border-bottom: 1px solid #55627a;
  white-space: nowrap;
}

.db-table th.db-col-center {
  text-align: center;
}

.db-table td {
  padding: 13px 12px;
  font-size: 13px;
  color: #e8ecf2;
  border-bottom: 1px solid #1d242e;
  vertical-align: middle;
  overflow: hidden;
}

.db-table td.db-col-center {
  text-align: center;
  color: #8c99ae;
}

/* Column widths */
.db-table .db-col-name     { width: auto; }
.db-table .db-col-date     { width: 140px; }
.db-table .db-col-sources  { width: 80px; }
.db-table .db-col-rows     { width: 70px; }
.db-table .db-col-cols     { width: 70px; }
.db-table .db-col-open     { width: 80px; }
.db-table .db-col-delete   { width: 56px; }
```

- [ ] **Step 2: Add row hover and name cell styles**

```css
/* ── Rows ───────────────────────────────────────────────── */
.db-table tbody tr {
  cursor: pointer;
  transition: background 0.1s;
}

.db-table tbody tr:hover {
  background: #171c23;
}

.db-record-name {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.db-record-date {
  color: #8c99ae;
  white-space: nowrap;
}
```

- [ ] **Step 3: Add action button styles**

```css
/* ── Action Buttons ─────────────────────────────────────── */
.db-open-btn {
  background: none;
  border: none;
  color: #e29a35;
  cursor: pointer;
  font-size: 13px;
  padding: 4px 8px;
  border-radius: 3px;
  font-family: inherit;
  transition: opacity 0.15s;
}

.db-open-btn:hover {
  opacity: 0.75;
}

.db-delete-btn {
  background: none;
  border: none;
  color: #55627a;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s;
}

.db-delete-btn:hover {
  color: #e05252;
}
```

- [ ] **Step 4: Add state styles (loading, empty, error, search-empty)**

```css
/* ── States ─────────────────────────────────────────────── */
.db-state-cell {
  padding: 56px 24px;
  text-align: center;
  color: #8c99ae;
  font-size: 14px;
}

.db-state-cell p {
  margin: 0 0 6px;
}

.db-state-sub {
  font-size: 12px;
  color: #55627a;
}

.db-error-text {
  color: #e05252 !important;
}

.db-retry-btn {
  margin-top: 14px;
  background: none;
  border: 1px solid #e05252;
  color: #e05252;
  padding: 6px 18px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  transition: background 0.15s;
  display: inline-block;
}

.db-retry-btn:hover {
  background: rgba(224, 82, 82, 0.1);
}

/* Spinner */
@keyframes db-spin {
  to { transform: rotate(360deg); }
}

.db-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid #1d242e;
  border-top-color: #e29a35;
  border-radius: 50%;
  animation: db-spin 0.7s linear infinite;
  display: inline-block;
  vertical-align: middle;
  margin-right: 8px;
}
```

- [ ] **Step 5: Commit**

```bash
git add css/master-records.css
git commit -m "feat(03-02): add table, row, button, and state CSS"
```

---

## Chunk 2: JavaScript

All code in this chunk goes **inside** `initMasterRecords()`, after the existing `state.hideDashboard` registration and before the closing `}` of `initMasterRecords`.

### Task 3: Helper Functions and Header Builder

**Files:**
- Modify: `js/master-records.js`

- [ ] **Step 1: Add formatDate and safeNum helpers**

Add inside `initMasterRecords()`, after `state.hideDashboard`:

```js
  // ── Helpers ─────────────────────────────────────────────
  function formatDate(isoString) {
    if (!isoString) return '—';
    var d = new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function safeNum(val) {
    return (val !== undefined && val !== null) ? val : '—';
  }
```

- [ ] **Step 2: Add buildHeader function**

```js
  // ── Header ──────────────────────────────────────────────
  function buildHeader() {
    var header = document.createElement('div');
    header.className = 'db-header';

    var title = document.createElement('h2');
    title.className = 'db-header-title';
    title.textContent = 'Master Records';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'db-close-btn';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', function () {
      state.hideDashboard();
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    return header;
  }
```

- [ ] **Step 3: Add buildTableHeader function**

```js
  // ── Table Header ─────────────────────────────────────────
  function buildTableHeader() {
    var thead = document.createElement('thead');
    var tr = document.createElement('tr');

    var cols = [
      { label: 'Name',         cls: 'db-col-name' },
      { label: 'Last Updated', cls: 'db-col-date' },
      { label: 'Sources',      cls: 'db-col-sources db-col-center' },
      { label: 'Rows',         cls: 'db-col-rows db-col-center' },
      { label: 'Cols',         cls: 'db-col-cols db-col-center' },
      { label: 'Open',         cls: 'db-col-open db-col-center' },
      { label: '',             cls: 'db-col-delete db-col-center' }
    ];

    cols.forEach(function (col) {
      var th = document.createElement('th');
      th.textContent = col.label;
      th.className = col.cls;
      tr.appendChild(th);
    });

    thead.appendChild(tr);
    return thead;
  }
```

- [ ] **Step 4: Commit**

```bash
git add js/master-records.js
git commit -m "feat(03-03): add formatDate, safeNum, buildHeader, buildTableHeader helpers"
```

---

### Task 4: State Row Builders

**Files:**
- Modify: `js/master-records.js`

- [ ] **Step 1: Add SVG icon constant and buildStateRow helper**

```js
  // ── State Rows ───────────────────────────────────────────
  var TRASH_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>';

  function buildStateRow(content) {
    var tr = document.createElement('tr');
    var td = document.createElement('td');
    td.colSpan = 7;
    td.className = 'db-state-cell';
    td.appendChild(content);
    tr.appendChild(td);
    return tr;
  }
```

- [ ] **Step 2: Add buildLoadingRow**

```js
  function buildLoadingRow() {
    var wrap = document.createElement('div');
    var spinner = document.createElement('span');
    spinner.className = 'db-spinner';
    var text = document.createTextNode(' Loading records...');
    wrap.appendChild(spinner);
    wrap.appendChild(text);
    return buildStateRow(wrap);
  }
```

- [ ] **Step 3: Add buildEmptyRow**

```js
  function buildEmptyRow() {
    var wrap = document.createElement('div');
    var p1 = document.createElement('p');
    p1.textContent = 'No saved consolidations yet.';
    var p2 = document.createElement('p');
    p2.className = 'db-state-sub';
    p2.textContent = 'Consolidate files to create your first record.';
    wrap.appendChild(p1);
    wrap.appendChild(p2);
    return buildStateRow(wrap);
  }
```

- [ ] **Step 4: Add buildErrorRow**

```js
  function buildErrorRow(onRetry) {
    var wrap = document.createElement('div');
    var p = document.createElement('p');
    p.className = 'db-error-text';
    p.textContent = '\u26a0 Failed to load records.';
    var btn = document.createElement('button');
    btn.className = 'db-retry-btn';
    btn.textContent = 'Try again';
    btn.addEventListener('click', onRetry);
    wrap.appendChild(p);
    wrap.appendChild(btn);
    return buildStateRow(wrap);
  }
```

- [ ] **Step 5: Add buildSearchEmptyRow**

```js
  function buildSearchEmptyRow() {
    var wrap = document.createElement('div');
    var p = document.createElement('p');
    p.textContent = 'No records match your search.';
    wrap.appendChild(p);
    return buildStateRow(wrap);
  }
```

- [ ] **Step 6: Commit**

```bash
git add js/master-records.js
git commit -m "feat(03-04): add loading, empty, error, and search-empty state row builders"
```

---

### Task 5: Row Builder and Reload Helper

**Files:**
- Modify: `js/master-records.js`

- [ ] **Step 1: Add reloadRecords helper**

This is the shared fetch-then-render path used by showDashboard, retry, and post-delete re-render.

```js
  // ── Reload ───────────────────────────────────────────────
  function reloadRecords() {
    showLoading();
    apiAdapter.getAll().then(function (records) {
      render(records);
    }).catch(function () {
      render(null);
    });
  }
```

Note: `showLoading` and `render` are defined in the next task — JavaScript hoisting handles forward references for `function` declarations.

- [ ] **Step 2: Add buildRow function**

```js
  // ── Row Builder ──────────────────────────────────────────
  function buildRow(record) {
    var tr = document.createElement('tr');

    function openRecord() {
      if (state.openFile && record.fileObj) {
        state.openFile(record.fileObj);
      }
      state.hideDashboard();
    }

    // Name
    var tdName = document.createElement('td');
    tdName.className = 'db-col-name';
    var nameSpan = document.createElement('span');
    nameSpan.className = 'db-record-name';
    nameSpan.textContent = record.name || '';
    nameSpan.title = record.name || '';
    tdName.appendChild(nameSpan);

    // Last Updated
    var tdDate = document.createElement('td');
    tdDate.className = 'db-col-date db-record-date';
    tdDate.textContent = formatDate(record.savedAt);

    // Sources
    var tdSources = document.createElement('td');
    tdSources.className = 'db-col-sources db-col-center';
    tdSources.textContent = safeNum(record.sourceCount);

    // Rows
    var tdRows = document.createElement('td');
    tdRows.className = 'db-col-rows db-col-center';
    tdRows.textContent = safeNum(record.rowCount);

    // Cols
    var tdCols = document.createElement('td');
    tdCols.className = 'db-col-cols db-col-center';
    tdCols.textContent = safeNum(record.colCount);

    // Open button
    var tdOpen = document.createElement('td');
    tdOpen.className = 'db-col-open db-col-center';
    var openBtn = document.createElement('button');
    openBtn.className = 'db-open-btn';
    openBtn.textContent = 'Open';
    openBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      openRecord();
    });
    tdOpen.appendChild(openBtn);

    // Delete button
    var tdDel = document.createElement('td');
    tdDel.className = 'db-col-delete db-col-center';
    var delBtn = document.createElement('button');
    delBtn.className = 'db-delete-btn';
    delBtn.innerHTML = TRASH_ICON;
    delBtn.title = 'Delete record';
    delBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!confirm('Delete this record?')) return;
      apiAdapter.remove(record.id).then(function () {
        reloadRecords();
      });
    });
    tdDel.appendChild(delBtn);

    tr.appendChild(tdName);
    tr.appendChild(tdDate);
    tr.appendChild(tdSources);
    tr.appendChild(tdRows);
    tr.appendChild(tdCols);
    tr.appendChild(tdOpen);
    tr.appendChild(tdDel);

    // Row click (anywhere except delete) opens record
    tr.addEventListener('click', openRecord);

    return tr;
  }
```

- [ ] **Step 3: Commit**

```bash
git add js/master-records.js
git commit -m "feat(03-05): add reloadRecords helper and buildRow with open and delete actions"
```

---

### Task 6: Search Builder, render(), showLoading(), and showDashboard Wire-up

**Files:**
- Modify: `js/master-records.js`

- [ ] **Step 1: Add buildSearch function**

```js
  // ── Search ───────────────────────────────────────────────
  function buildSearch(allRecords, tbody) {
    var bar = document.createElement('div');
    bar.className = 'db-search-bar';

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'db-search-input';
    input.placeholder = 'Search records...';
    input.setAttribute('autocomplete', 'off');

    var clearBtn = document.createElement('button');
    clearBtn.className = 'db-search-clear';
    clearBtn.textContent = '\u2715';
    clearBtn.type = 'button';

    function filterAndRender() {
      var q = (input.value || '').toLowerCase();
      clearBtn.style.display = q ? 'inline' : 'none';
      tbody.innerHTML = '';
      var filtered = allRecords.filter(function (r) {
        return (r.name || '').toLowerCase().indexOf(q) !== -1;
      });
      if (filtered.length === 0) {
        tbody.appendChild(q ? buildSearchEmptyRow() : buildEmptyRow());
      } else {
        filtered.forEach(function (r) {
          tbody.appendChild(buildRow(r));
        });
      }
    }

    input.addEventListener('input', filterAndRender);

    clearBtn.addEventListener('click', function () {
      input.value = '';
      filterAndRender();
    });

    bar.appendChild(input);
    bar.appendChild(clearBtn);
    return bar;
  }
```

- [ ] **Step 2: Add showLoading function**

```js
  // ── Loading shell ────────────────────────────────────────
  function showLoading() {
    dashboardRoot.innerHTML = '';
    dashboardRoot.appendChild(buildHeader());

    var tableArea = document.createElement('div');
    tableArea.className = 'db-table-area';

    var table = document.createElement('table');
    table.className = 'db-table';
    table.appendChild(buildTableHeader());

    var tbody = document.createElement('tbody');
    tbody.appendChild(buildLoadingRow());
    table.appendChild(tbody);
    tableArea.appendChild(table);
    dashboardRoot.appendChild(tableArea);
  }
```

- [ ] **Step 3: Add render function**

```js
  // ── Render ───────────────────────────────────────────────
  function render(records) {
    dashboardRoot.innerHTML = '';
    dashboardRoot.appendChild(buildHeader());

    // Error state — no search bar, just error in table
    if (!records) {
      var tableAreaErr = document.createElement('div');
      tableAreaErr.className = 'db-table-area';
      var tableErr = document.createElement('table');
      tableErr.className = 'db-table';
      tableErr.appendChild(buildTableHeader());
      var tbodyErr = document.createElement('tbody');
      tbodyErr.appendChild(buildErrorRow(reloadRecords));
      tableErr.appendChild(tbodyErr);
      tableAreaErr.appendChild(tableErr);
      dashboardRoot.appendChild(tableAreaErr);
      return;
    }

    var tbody = document.createElement('tbody');

    if (records.length === 0) {
      tbody.appendChild(buildEmptyRow());
    } else {
      records.forEach(function (r) {
        tbody.appendChild(buildRow(r));
      });
    }

    var searchBar = buildSearch(records, tbody);
    dashboardRoot.appendChild(searchBar);

    var tableArea = document.createElement('div');
    tableArea.className = 'db-table-area';
    var table = document.createElement('table');
    table.className = 'db-table';
    table.appendChild(buildTableHeader());
    table.appendChild(tbody);
    tableArea.appendChild(table);
    dashboardRoot.appendChild(tableArea);
  }
```

- [ ] **Step 4: Update state.showDashboard to wire in render**

Replace the existing `state.showDashboard` block:

```js
  // BEFORE (remove this):
  state.showDashboard = function () {
    dashboardRoot.style.display = 'block';
    apiAdapter.getAll().then(function (records) {
      // Phase 3 will add: render(records)
    });
  };

  // AFTER (replace with this):
  state.showDashboard = function () {
    dashboardRoot.style.display = 'flex';
    reloadRecords();
  };
```

- [ ] **Step 5: Commit**

```bash
git add js/master-records.js
git commit -m "feat(03-06): add buildSearch, showLoading, render, and wire showDashboard"
```

---

### Task 7: Manual Verification

**Files:** None (read-only verification)

- [ ] **Step 1: Start the local server**

```bash
node serve.mjs
```

Open `http://localhost:3000` in the browser.

- [ ] **Step 2: Verify empty state**

Open the app. Trigger `state.showDashboard()` from the browser console:
```js
import('./js/state.js').then(m => m.state.showDashboard())
```
Expected: Full-screen dark overlay appears. Header shows "Master Records" and "Close" button. Search bar below header. Table with column headers. Empty state message: "No saved consolidations yet."

- [ ] **Step 3: Verify loading state**

Open browser DevTools → Network → throttle to Slow 3G. Trigger showDashboard again.
Expected: Spinning amber spinner + "Loading records..." appears briefly before records load.

- [ ] **Step 4: Verify with seeded data**

In the console, seed a record then open the dashboard:
```js
import('./js/state.js').then(function(m) {
  var s = m.state;
  s.saveMasterRecord({ sourceCount: 3, rowCount: 120, colCount: 8, fileObj: null });
  s.saveMasterRecord({ sourceCount: 1, rowCount: 45, colCount: 5, fileObj: null });
  s.showDashboard();
});
```
Expected: Two rows appear with auto-generated names, today's date, correct source/row/col counts, amber "Open" button, muted delete icon.

- [ ] **Step 5: Verify search**

Type part of a record name in the search bar.
Expected: Table filters in real-time. Clear (✕) button appears. Clearing it restores all rows.

- [ ] **Step 6: Verify delete**

Click the delete icon on a row.
Expected: `confirm()` dialog appears. Confirm → row disappears, table re-renders. Cancel → nothing changes.

- [ ] **Step 7: Verify close**

Click "Close" button.
Expected: Overlay disappears, three-panel layout is visible again.

- [ ] **Step 8: Commit verification note**

```bash
git commit --allow-empty -m "chore(03-07): manual verification passed for Phase 3 dashboard renderer"
```

---

## Final State

After all tasks complete, `js/master-records.js` will have:
- `formatDate`, `safeNum` — formatting helpers
- `buildHeader` — fixed header with Close button
- `buildTableHeader` — sticky `<thead>` with 7 columns
- `buildStateRow`, `buildLoadingRow`, `buildEmptyRow`, `buildErrorRow`, `buildSearchEmptyRow` — state displays
- `buildRow` — single record row with open + delete
- `buildSearch` — search bar with client-side filter and clear button
- `showLoading` — loading shell (shown immediately on open)
- `render(records)` — full dashboard render (null = error state)
- `reloadRecords` — shared fetch-then-render path
- `state.showDashboard` — updated to show flex + call reloadRecords

And `css/master-records.css` will have all styles for the overlay, header, search, table, rows, buttons, and states.
