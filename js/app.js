// Entry point — imports and initializes all modules
// Init order matters: chat first (registers addMessage), excel-editor second
// (registers openFile/closeFile), then everything else.
//
// OWNERSHIP: Group 3 (Infrastructure) owns this file.
// All imports are pre-wired — each group just implements their init() function.

import { state } from './state.js';
import { initChat } from './chat.js';
import { initExcelEditor } from './excel-editor.js';
import { initFileIngestion } from './file-ingestion.js';
import { initConsolidation } from './consolidation.js';
import { initAiOperations } from './ai-operations.js';
import { initMasterRecords } from './master-records.js';

// API keys live in backend/.env — frontend calls /api/ai/* proxy (see serve.mjs)

// Phase 1–4 modules (core app)
initChat();
initExcelEditor();
initFileIngestion();
initConsolidation();

// Phase 5: AI spreadsheet operations (Group 1)
initAiOperations();

// Phase 6: Master records dashboard (Group 2)
initMasterRecords();

// Wire Records button
document.getElementById('records-btn').addEventListener('click', () => {
  if (state.showDashboard) state.showDashboard();
});
