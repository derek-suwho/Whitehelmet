# Whitehelmet — Group 2: Frontend, Records & Dashboard

## Project
Whitehelmet is a web app for construction companies that consolidates subcontractor Excel reports into a master record. It has a three-panel layout: sources panel (left), spreadsheet editor (center), AI chat (right). Users upload .xlsx files, select multiple, hit Consolidate, and Claude merges them into one spreadsheet. The app is a single `index.html` with vanilla JS ES modules and no build step.

## This group's role
You own two things: (1) file and folder upload — letting users bring .xlsx files into the sources panel, and (2) the master records dashboard — saving consolidations, browsing past ones, and reopening them.

## Your files
- `js/file-ingestion.js` — file and folder upload logic
- `js/master-records.js` — records data layer and dashboard logic
- `css/master-records.css` — all your styles go here

## Do not touch
`js/state.js`, `js/app.js`, `index.html`, `js/chat.js`, `js/excel-editor.js`, `js/consolidation.js`, `js/ai-operations.js`, `css/styles.css`

## Key interfaces
- `state.saveMasterRecord(record)` — register this function to save a record to `state.masterRecords[]`
- `state.showDashboard()` / `state.hideDashboard()` — register these to toggle the dashboard
- `state.masterRecords[]` — the array of saved records
- `state.openFile(fileObj)` — opens a file in the spreadsheet editor
- `state.addMessage(text, 'ai')` — post a message to the chat panel
- `#dashboard-root` — the div in index.html where your dashboard renders (hidden by default)
- `/api/records` — Group 3's backend endpoints for persistence (GET, POST, DELETE). Mock locally until backend is ready.

## Design tokens (match the existing dark theme)
- Background: `#0f1217` (base), `#171c23` (elevated), `#1d242e` (panel)
- Accent: `#e29a35` (amber)
- Text: `#e8ecf2` (primary), `#8c99ae` (secondary), `#55627a` (muted)
- See `css/styles.css` for all existing patterns to follow

## Running locally
```bash
node serve.mjs   # starts server at http://localhost:3000
```
