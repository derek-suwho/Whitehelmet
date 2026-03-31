// ── Master Records & Dashboard (Group 2) ─────────────────
// OWNERSHIP: Group 2 owns this file and css/master-records.css.
//
// This module manages the master records dashboard — listing consolidated
// records, auto-generating metadata, and aggregating metadata from sub-reports.
//
// Interface contract:
//   - Register state.saveMasterRecord = (record) => void
//   - Register state.showDashboard = () => void
//   - Register state.hideDashboard = () => void
//   - Render dashboard UI inside #dashboard-root
//   - Use state.masterRecords[] as the data store
//   - Use state.addMessage(text, 'ai') to post notifications to chat
//   - Use state.openFile(fileObj) to open a record in the editor

import { state } from './state.js';

export function initMasterRecords() {
  var dashboardRoot = document.getElementById('dashboard-root');
  var currentSortCol = 'savedAt';   // default: Last Updated
  var currentSortDir = 'desc';      // default: newest first
  var lastFetchedRecords = [];       // cache for sort-without-refetch
  var escHandler = null;             // named ref for removeEventListener

  /**
   * Master Record Schema
   * --------------------
   * id          {string}  — unique identifier, generated via Date.now().toString()
   * name        {string}  — auto-generated label (e.g. "Consolidation — Mar 31, 2026")
   * savedAt     {string}  — ISO 8601 timestamp, new Date().toISOString()
   * sourceCount {number}  — number of source files used in consolidation
   * rowCount    {number}  — row count of the merged spreadsheet
   * colCount    {number}  — column count of the merged spreadsheet
   * fileObj     {File}    — the synthetic .xlsx File object from consolidation
   */

  var apiAdapter = {
    getAll: function () {
      return Promise.resolve(state.masterRecords.slice());
      // Real swap: return fetch('/api/records').then(r => r.json());
    },
    post: function (record) {
      state.masterRecords.push(record);
      return Promise.resolve(record);
      // Real swap: return fetch('/api/records', { method: 'POST', body: JSON.stringify(record), headers: {'Content-Type':'application/json'} }).then(r => r.json());
    },
    remove: function (id) {
      var idx = state.masterRecords.findIndex(function (r) { return r.id === id; });
      if (idx > -1) {
        state.masterRecords.splice(idx, 1);
      }
      return Promise.resolve();
      // Real swap: return fetch('/api/records/' + id, { method: 'DELETE' });
    }
  };

  function generateName() {
    var today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    var base = 'Consolidation \u2014 ' + today;
    var count = state.masterRecords.filter(function (r) {
      return r.name && r.name.indexOf(base) === 0;
    }).length;
    return count === 0 ? base : base + ' (' + (count + 1) + ')';
  }

  state.saveMasterRecord = function (record) {
    record.id      = Date.now().toString();
    record.name    = record.name || generateName();
    record.savedAt = new Date().toISOString();
    apiAdapter.post(record);
  };

  state.showDashboard = function () {
    dashboardRoot.style.display = 'flex';
    reloadRecords();
  };

  state.hideDashboard = function () {
    dashboardRoot.style.display = 'none';
  };

  // ── Helpers ─────────────────────────────────────────────
  function formatDate(isoString) {
    if (!isoString) return '—';
    var d = new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function safeNum(val) {
    return (val !== undefined && val !== null) ? val : '—';
  }

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

  function buildLoadingRow() {
    var wrap = document.createElement('div');
    var spinner = document.createElement('span');
    spinner.className = 'db-spinner';
    var text = document.createTextNode(' Loading records...');
    wrap.appendChild(spinner);
    wrap.appendChild(text);
    return buildStateRow(wrap);
  }

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

  function buildSearchEmptyRow() {
    var wrap = document.createElement('div');
    var p = document.createElement('p');
    p.textContent = 'No records match your search.';
    wrap.appendChild(p);
    return buildStateRow(wrap);
  }

  // ── Reload ───────────────────────────────────────────────
  function reloadRecords() {
    showLoading();
    apiAdapter.getAll().then(function (records) {
      render(records);
    }).catch(function () {
      render(null);
    });
  }

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
}
