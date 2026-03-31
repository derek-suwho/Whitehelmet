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
}
