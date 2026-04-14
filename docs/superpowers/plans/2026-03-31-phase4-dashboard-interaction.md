# Phase 4: Dashboard Interaction Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add column sorting (Name and Last Updated), a dynamic record count label, and Escape-to-close to the master records dashboard.

**Architecture:** All changes stay inside the `initMasterRecords()` closure. Three new closure variables (`currentSortCol`, `currentSortDir`, `lastFetchedRecords`) hold sort state and the last-fetched records so header clicks can re-sort without re-fetching. `buildTableHeader()` is updated to accept records and wire sort clicks. `render()` and `filterAndRender()` both call `sortRecords()` before rendering rows. A count label element is passed between `render()` and `buildSearch()` so both can update it.

**Tech Stack:** Vanilla JS (ES5 — `var` only, no arrow functions, no `let`/`const`), no build step, no test framework. Verification is manual in the browser via `node serve.mjs`.

---

## Chunk 1: CSS

### Task 1: Sortable Header and Record Count Styles

**Files:**
- Modify: `css/master-records.css`

- [ ] **Step 1: Add sortable header styles**

Append to `css/master-records.css`:

```css
/* ── Sortable Headers ───────────────────────────────────── */
.db-th-sortable {
  cursor: pointer;
  user-select: none;
}

.db-th-sortable:hover {
  color: #8c99ae;
}

.db-th-active {
  color: #e8ecf2;
}

.db-sort-arrow {
  display: inline-block;
  margin-left: 5px;
  font-size: 11px;
  color: #55627a;
}

.db-th-active .db-sort-arrow {
  color: #e8ecf2;
}
```

- [ ] **Step 2: Add record count label styles**

```css
/* ── Record Count ───────────────────────────────────────── */
.db-record-count {
  padding: 8px 24px;
  font-size: 12px;
  color: #8c99ae;
  flex-shrink: 0;
}
```

- [ ] **Step 3: Commit**

```bash
git add css/master-records.css
git commit -m "feat(04-01): add sortable header and record count CSS"
```

---

## Chunk 2: JavaScript

All JS changes are inside `initMasterRecords()` in `js/master-records.js`.

### Task 2: Sort State Variables and sortRecords Function

**Files:**
- Modify: `js/master-records.js`

- [ ] **Step 1: Add four closure variables after `var dashboardRoot = ...`**

Insert immediately after line `var dashboardRoot = document.getElementById('dashboard-root');`:

```js
  var currentSortCol = 'savedAt';   // default: Last Updated
  var currentSortDir = 'desc';      // default: newest first
  var lastFetchedRecords = [];       // cache for sort-without-refetch
  var escHandler = null;             // named ref for removeEventListener
```

- [ ] **Step 2: Add sortRecords function after the safeNum helper**

Insert after the `safeNum` function (after line `return (val !== undefined && val !== null) ? val : '—';`):

```js
  // ── Sort ─────────────────────────────────────────────────
  function sortRecords(records) {
    var sorted = records.slice();
    sorted.sort(function (a, b) {
      var cmp;
      if (currentSortCol === 'name') {
        cmp = (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      } else {
        var aVal = a.savedAt || '';
        var bVal = b.savedAt || '';
        cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }
      return currentSortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }
```

- [ ] **Step 3: Commit**

```bash
git add js/master-records.js
git commit -m "feat(04-02): add sort state variables and sortRecords function"
```

---

### Task 3: Update buildTableHeader with Sort Indicators

**Files:**
- Modify: `js/master-records.js`

- [ ] **Step 1: Replace buildTableHeader entirely**

Replace the existing `buildTableHeader` function (lines 111–134 in the original file) with:

```js
  // ── Table Header ─────────────────────────────────────────
  function buildTableHeader() {
    var thead = document.createElement('thead');
    var tr = document.createElement('tr');

    var cols = [
      { label: 'Name',         cls: 'db-col-name',                    sortKey: 'name' },
      { label: 'Last Updated', cls: 'db-col-date',                    sortKey: 'savedAt' },
      { label: 'Sources',      cls: 'db-col-sources db-col-center',   sortKey: null },
      { label: 'Rows',         cls: 'db-col-rows db-col-center',      sortKey: null },
      { label: 'Cols',         cls: 'db-col-cols db-col-center',      sortKey: null },
      { label: 'Open',         cls: 'db-col-open db-col-center',      sortKey: null },
      { label: '',             cls: 'db-col-delete db-col-center',    sortKey: null }
    ];

    cols.forEach(function (col) {
      var th = document.createElement('th');
      th.className = col.cls;

      if (col.sortKey) {
        var isActive = currentSortCol === col.sortKey;
        th.className += ' db-th-sortable';
        if (isActive) th.className += ' db-th-active';

        var labelText = document.createTextNode(col.label);
        var arrow = document.createElement('span');
        arrow.className = 'db-sort-arrow';
        if (isActive) {
          arrow.textContent = currentSortDir === 'asc' ? '\u2191' : '\u2193';
        } else {
          arrow.textContent = '\u2195';
        }

        th.appendChild(labelText);
        th.appendChild(arrow);

        th.addEventListener('click', (function (sortKey) {
          return function () {
            if (currentSortCol === sortKey) {
              currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
            } else {
              currentSortCol = sortKey;
              currentSortDir = 'asc';
            }
            render(lastFetchedRecords);
          };
        }(col.sortKey)));

      } else {
        th.textContent = col.label;
      }

      tr.appendChild(th);
    });

    thead.appendChild(tr);
    return thead;
  }
```

- [ ] **Step 2: Verify showLoading call site is already correct**

`showLoading()` calls `buildTableHeader()` with no arguments — correct, no change needed.

Note: The existing `render()` also calls `buildTableHeader()` in two places. Task 4 replaces `render()` entirely, resolving those. Apply Tasks 3 and 4 before testing.

- [ ] **Step 3: Commit**

```bash
git add js/master-records.js
git commit -m "feat(04-03): update buildTableHeader with sort indicators and click handlers"
```

---

### Task 4: Update render and buildSearch with Sort and Count Label

**Files:**
- Modify: `js/master-records.js`

- [ ] **Step 1: Replace buildSearch to integrate sort and count updates**

Replace the existing `buildSearch` function with:

```js
  // ── Search ───────────────────────────────────────────────
  function buildSearch(allRecords, tbody, countEl) {
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

      var sorted = sortRecords(filtered);

      // Update count label
      if (countEl) {
        if (sorted.length === 0) {
          countEl.style.display = 'none';
        } else if (q) {
          countEl.style.display = '';
          countEl.textContent = 'Showing ' + sorted.length + ' of ' + allRecords.length + ' records';
        } else {
          countEl.style.display = '';
          countEl.textContent = allRecords.length + ' record' + (allRecords.length !== 1 ? 's' : '');
        }
      }

      if (sorted.length === 0) {
        tbody.appendChild(q ? buildSearchEmptyRow() : buildEmptyRow());
      } else {
        sorted.forEach(function (r) {
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
    return { bar: bar, filterAndRender: filterAndRender };
  }
```

- [ ] **Step 2: Replace render to wire sort, count label, and updated buildSearch**

Replace the existing `render` function with:

```js
  // ── Render ───────────────────────────────────────────────
  function render(records) {
    dashboardRoot.innerHTML = '';
    dashboardRoot.appendChild(buildHeader());

    // Error state — no search bar or count, just error in table
    if (!records) {
      var tableAreaErr = document.createElement('div');
      tableAreaErr.className = 'db-table-area';
      var tableErr = document.createElement('table');
      tableErr.className = 'db-table';
      tableErr.appendChild(buildTableHeader([]));
      var tbodyErr = document.createElement('tbody');
      tbodyErr.appendChild(buildErrorRow(reloadRecords));
      tableErr.appendChild(tbodyErr);
      tableAreaErr.appendChild(tableErr);
      dashboardRoot.appendChild(tableAreaErr);
      return;
    }

    var sorted = sortRecords(records);
    var tbody = document.createElement('tbody');

    if (sorted.length === 0) {
      tbody.appendChild(buildEmptyRow());
    } else {
      sorted.forEach(function (r) {
        tbody.appendChild(buildRow(r));
      });
    }

    // Search bar
    var countEl = document.createElement('div');
    countEl.className = 'db-record-count';
    countEl.textContent = records.length + ' record' + (records.length !== 1 ? 's' : '');
    if (records.length === 0) countEl.style.display = 'none';

    var searchResult = buildSearch(records, tbody, countEl);
    dashboardRoot.appendChild(searchResult.bar);
    dashboardRoot.appendChild(countEl);

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

- [ ] **Step 3: Commit**

```bash
git add js/master-records.js
git commit -m "feat(04-04): update render and buildSearch with sort, count label"
```

---

### Task 5: Update reloadRecords, showDashboard, and hideDashboard

**Files:**
- Modify: `js/master-records.js`

- [ ] **Step 1: Update reloadRecords to cache lastFetchedRecords**

Replace:
```js
  function reloadRecords() {
    showLoading();
    apiAdapter.getAll().then(function (records) {
      render(records);
    }).catch(function () {
      render(null);
    });
  }
```

With:
```js
  function reloadRecords() {
    showLoading();
    apiAdapter.getAll().then(function (records) {
      lastFetchedRecords = records;
      render(records);
    }).catch(function () {
      render(null);
    });
  }
```

- [ ] **Step 2: Update state.showDashboard to attach Escape handler**

Replace:
```js
  state.showDashboard = function () {
    dashboardRoot.style.display = 'flex';
    reloadRecords();
  };
```

With:
```js
  state.showDashboard = function () {
    dashboardRoot.style.display = 'flex';
    if (escHandler) {
      document.removeEventListener('keydown', escHandler);
    }
    escHandler = function (e) {
      if (e.key === 'Escape') state.hideDashboard();
    };
    document.addEventListener('keydown', escHandler);
    reloadRecords();
  };
```

- [ ] **Step 3: Update state.hideDashboard to remove Escape handler**

Replace:
```js
  state.hideDashboard = function () {
    dashboardRoot.style.display = 'none';
  };
```

With:
```js
  state.hideDashboard = function () {
    dashboardRoot.style.display = 'none';
    if (escHandler) {
      document.removeEventListener('keydown', escHandler);
      escHandler = null;
    }
  };
```

- [ ] **Step 4: Commit**

```bash
git add js/master-records.js
git commit -m "feat(04-05): cache lastFetchedRecords, add Escape-to-close handler"
```

---

### Task 6: Manual Verification

**Files:** None (read-only verification)

- [ ] **Step 1: Start the local server (if not already running)**

```bash
node serve.mjs
```

Open `http://localhost:3000`.

- [ ] **Step 2: Seed records and open dashboard**

In the browser console:

```js
import('./js/state.js').then(function(m) {
  var s = m.state;
  s.saveMasterRecord({ name: 'Alpha Report', sourceCount: 2, rowCount: 80,  colCount: 6, fileObj: null });
  s.saveMasterRecord({ name: 'Zeta Report',  sourceCount: 5, rowCount: 200, colCount: 9, fileObj: null });
  s.saveMasterRecord({ name: 'Beta Report',  sourceCount: 1, rowCount: 30,  colCount: 4, fileObj: null });
  s.showDashboard();
});
```

- [ ] **Step 3: Verify default sort**

Expected: Records appear in newest-first order (Zeta, Beta, Alpha — most recently saved first). "Last Updated" header shows `↓`. "Name" header shows `↕`.

- [ ] **Step 4: Verify sort toggle**

Click "Last Updated" header.
Expected: Order reverses (oldest first). Arrow changes to `↑`.

Click "Name" header.
Expected: Records sort A→Z (Alpha, Beta, Zeta). "Name" header shows `↑`, "Last Updated" resets to `↕`.

Click "Name" again.
Expected: Records sort Z→A. Arrow changes to `↓`.

- [ ] **Step 5: Verify sort + search composition**

Type `"eta"` in the search bar.
Expected: Only "Beta Report" and "Zeta Report" appear, in current sort order. Count label shows "Showing 2 of 3 records".

- [ ] **Step 6: Verify record count**

Clear the search.
Expected: Count shows "3 records". All three rows visible.

- [ ] **Step 7: Verify Escape to close**

Press the Escape key.
Expected: Dashboard closes, three-panel layout is visible.

Open dashboard again (`s.showDashboard()` in console), close with the Close button, then open again. Press Escape.
Expected: Still closes correctly (listener not stacked).

- [ ] **Step 8: Commit verification note**

```bash
git commit --allow-empty -m "chore(04-06): manual verification passed for Phase 4 dashboard interaction"
```

---

## Final State

After all tasks complete, the new additions to `js/master-records.js` are:
- `currentSortCol`, `currentSortDir`, `lastFetchedRecords`, `escHandler` — closure variables
- `sortRecords(records)` — returns sorted copy respecting current sort state
- `buildTableHeader(records)` — updated with sort indicators and click handlers
- `buildSearch(allRecords, tbody, countEl)` — updated to sort before rendering and update count label
- `render(records)` — updated to sort, create count label, pass it to buildSearch
- `reloadRecords()` — updated to cache `lastFetchedRecords`
- `state.showDashboard` — updated to attach named Escape listener
- `state.hideDashboard` — updated to remove Escape listener safely

And `css/master-records.css` adds:
- `.db-th-sortable`, `.db-th-active`, `.db-sort-arrow` — sort header styles
- `.db-record-count` — count label styles
