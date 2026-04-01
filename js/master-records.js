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
    if (escHandler) {
      document.removeEventListener('keydown', escHandler);
    }
    escHandler = function (e) {
      if (e.key === 'Escape') state.hideDashboard();
    };
    document.addEventListener('keydown', escHandler);
    reloadRecords();
  };

  state.hideDashboard = function () {
    dashboardRoot.style.display = 'none';
    if (escHandler) {
      document.removeEventListener('keydown', escHandler);
      escHandler = null;
    }
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

  // ── Consolidation Metadata ───────────────────────────────
  function getConsolidationMeta() {
    var fileName = (state.excelState && state.excelState.fileName) || '';
    var match = fileName.match(/(\d+) source/);
    var sourceCount = match ? parseInt(match[1], 10) : 0;

    var rowCount = 0;
    var colCount = 0;
    if (state.excelState && state.excelState.instance) {
      try {
        var data = state.excelState.instance.getData();
        var nonEmpty = data.filter(function (row) {
          return row.some(function (cell) {
            return cell !== '' && cell !== null && cell !== undefined;
          });
        });
        rowCount = nonEmpty.length > 0 ? nonEmpty.length - 1 : 0; // subtract header row
        colCount = nonEmpty.length > 0 ? nonEmpty[0].length : 0;
      } catch (e) {
        // getData() unavailable — leave rowCount/colCount as 0
      }
    }
    return { sourceCount: sourceCount, rowCount: rowCount, colCount: colCount };
  }

  // ── Save Bar ─────────────────────────────────────────────
  var saveBar = null;

  function buildSaveBar() {
    var bar = document.createElement('div');
    bar.id = 'save-record-bar';

    var msg = document.createElement('span');
    msg.className = 'save-bar-message';
    msg.innerHTML = '<strong>Consolidation ready.</strong> Save this result to your records?';

    var actions = document.createElement('div');
    actions.className = 'save-bar-actions';

    var saveBtn = document.createElement('button');
    saveBtn.className = 'save-bar-btn';
    saveBtn.textContent = 'Save to Records';
    saveBtn.addEventListener('click', function () {
      showSaveModal();
    });

    var dismissBtn = document.createElement('button');
    dismissBtn.className = 'save-bar-dismiss';
    dismissBtn.textContent = 'Not now';
    dismissBtn.addEventListener('click', function () {
      hideSaveBar();
    });

    actions.appendChild(saveBtn);
    actions.appendChild(dismissBtn);
    bar.appendChild(msg);
    bar.appendChild(actions);
    return bar;
  }

  function showSaveBar() {
    if (!saveBar) {
      saveBar = buildSaveBar();
      document.body.appendChild(saveBar);
    }
    saveBar.style.display = 'flex';
  }

  function hideSaveBar() {
    if (saveBar) {
      saveBar.style.display = 'none';
    }
  }

  // ── Save Modal ───────────────────────────────────────────
  function showSaveModal() {
    var meta = getConsolidationMeta();

    var overlay = document.createElement('div');
    overlay.className = 'save-modal-overlay';

    var modal = document.createElement('div');
    modal.className = 'save-modal';

    var title = document.createElement('h3');
    title.className = 'save-modal-title';
    title.textContent = 'Save to Records';

    var label = document.createElement('label');
    label.className = 'save-modal-label';
    label.textContent = 'Record name';

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'save-modal-input';
    input.value = generateName();
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('maxlength', '120');

    var errorMsg = document.createElement('p');
    errorMsg.className = 'save-modal-error';

    var footer = document.createElement('div');
    footer.className = 'save-modal-footer';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'save-modal-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.type = 'button';

    var saveBtn = document.createElement('button');
    saveBtn.className = 'save-modal-save';
    saveBtn.textContent = 'Save';
    saveBtn.type = 'button';

    function closeModal() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    function setLoading(loading) {
      saveBtn.disabled = loading;
      cancelBtn.disabled = loading;
      saveBtn.textContent = loading ? 'Saving\u2026' : 'Save';
    }

    function setError(msg) {
      errorMsg.textContent = msg || '';
      if (msg) {
        input.classList.add('input-error');
      } else {
        input.classList.remove('input-error');
      }
    }

    cancelBtn.addEventListener('click', closeModal);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });

    saveBtn.addEventListener('click', function () {
      var name = (input.value || '').trim();
      if (!name) {
        setError('Name is required.');
        input.focus();
        return;
      }
      setError('');
      setLoading(true);

      var payload = {
        name:        name,
        savedAt:     new Date().toISOString(),
        sourceCount: meta.sourceCount,
        rowCount:    meta.rowCount,
        colCount:    meta.colCount
      };

      apiAdapter.post(payload).then(function (saved) {
        closeModal();
        hideSaveBar();
        if (state.addMessage) {
          state.addMessage('\u2713 Saved \u201c' + saved.name + '\u201d to records.', 'ai');
        }
      }).catch(function (err) {
        setLoading(false);
        setError('Save failed. Please try again.');
        console.error('Save error:', err);
      });
    });

    input.addEventListener('input', function () {
      if (input.value.trim()) setError('');
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(saveBtn);
    modal.appendChild(title);
    modal.appendChild(label);
    modal.appendChild(input);
    modal.appendChild(errorMsg);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Focus and select all so user can type immediately
    setTimeout(function () { input.select(); }, 0);
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
      lastFetchedRecords = records;
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

    // Error state — no search bar or count, just error in table
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

    var sorted = sortRecords(records);
    var tbody = document.createElement('tbody');

    if (sorted.length === 0) {
      tbody.appendChild(buildEmptyRow());
    } else {
      sorted.forEach(function (r) {
        tbody.appendChild(buildRow(r));
      });
    }

    // Count label
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

  // ── Consolidation Detection ──────────────────────────────
  // Watches the Excel Editor panel's header badge for filename changes.
  //
  // DEPENDENCY: relies on .panel-center .panel-header-badge being updated
  // by excel-editor.js after state.openFile() completes. If the DOM
  // structure or the update mechanism changes, update this selector and
  // the isConsolidation check below.
  //
  // The save bar is only shown when we are confident a consolidation result
  // is loaded: state.excelState must exist, fileName must be a non-empty
  // string, and it must start with 'Consolidated' (the prefix hardcoded in
  // consolidation.js). Any ambiguity keeps the bar hidden.
  (function () {
    var badge = document.querySelector('.panel-center .panel-header-badge');

    // Fail gracefully if the expected badge element is absent.
    // The save bar simply won't appear — no error thrown.
    if (!badge) {
      return;
    }

    function isConsolidationLoaded() {
      // Guard: excelState must exist and fileName must be a non-empty string
      if (!state.excelState) { return false; }
      var fileName = state.excelState.fileName;
      if (typeof fileName !== 'string' || fileName.length === 0) { return false; }
      // 'Consolidated' is the prefix set by consolidation.js — see consolidation.js line ~111
      // If that prefix ever changes, update this string to match.
      return fileName.indexOf('Consolidated') === 0;
    }

    var observer = new MutationObserver(function () {
      if (isConsolidationLoaded()) {
        showSaveBar();
      } else {
        hideSaveBar();
      }
    });

    observer.observe(badge, { childList: true, characterData: true, subtree: true });
  }());
}
