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
    dashboardRoot.style.display = 'block';
    apiAdapter.getAll().then(function (records) {
      // Phase 3 will add: render(records)
    });
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
}
