// Shared application state — replaces window.* globals
// All modules import from here instead of using window scope
//
// OWNERSHIP: Group 3 (Infrastructure) owns this file.
// Groups 1 & 2: your state properties are pre-defined below — just use them.

export const state = {
  apiKey: 'YOUR_KEY_HERE', // TODO: remove before sharing
  conversationHistory: [],
  excelState: { instance: null, workbook: null, fileName: null },

  // Functions registered by modules during init
  addMessage: null,   // set by chat.js
  openFile: null,     // set by excel-editor.js
  closeFile: null,    // set by excel-editor.js

  // ── Group 1: AI Operations ────────────────────────────
  // Chat command interceptor. If set, chat.js calls this before sending to API.
  // Signature: async (userText) => boolean
  //   - Return true if the command was handled (chat.js skips API call)
  //   - Return false to fall through to normal chat
  chatCommandHandler: null,  // set by ai-operations.js

  // ── Group 2: Master Records ───────────────────────────
  masterRecords: [],          // array of saved consolidation records
  saveMasterRecord: null,     // set by master-records.js — (record) => void
  showDashboard: null,        // set by master-records.js — () => void
  hideDashboard: null,        // set by master-records.js — () => void
};
