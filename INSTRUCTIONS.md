# Group 2 — Frontend: Records, Dashboard & File Upload

## What you're building
Two things: (1) the file/folder upload experience so users can bring their Excel reports into the app, and (2) a saved records dashboard so users can save consolidations, browse past ones, and reopen them.

## Your files
- `js/file-ingestion.js` — file and folder upload logic
- `js/master-records.js` — saved records data layer and dashboard logic
- `css/master-records.css` — all your styles go here

## Do not touch
Everything else. Especially `js/state.js`, `js/app.js`, and `index.html` — these are pre-wired for you.

## How it works
- Dashboard renders inside the `#dashboard-root` div (already in index.html, hidden by default)
- Register `state.showDashboard()` and `state.hideDashboard()` to toggle it
- Register `state.saveMasterRecord(record)` to save a record to `state.masterRecords[]`
- Use `state.openFile(fileObj)` to reopen a saved record in the spreadsheet editor
- Use `state.addMessage(text, 'ai')` to post notifications to chat
- All persistence goes through Group 3's API (`/api/records`) — no localStorage
- Match the existing dark theme: base `#0f1217`, amber accent `#e29a35`, see `css/styles.css` for all tokens

## Two roles
- **Person 2A (Data Layer):** Save/load/delete records, metadata extraction (date, source files, row/column counts), calls Group 3's `/api/records` endpoints
- **Person 2B (Dashboard UI):** Card or table layout listing all saved records, click to reopen, styling in `css/master-records.css`

## Getting started
1. Run `node serve.mjs` to start the local server at http://localhost:3000
2. Run `/gsd:new-project` in Claude Code to set up your planning
3. Group 3's API endpoints (`/api/records`) won't exist yet — stub them out or mock locally while you wait
