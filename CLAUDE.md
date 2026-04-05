# Whitehelmet — Group 1: AI Spreadsheet Operations

## Project
Whitehelmet is a web app for construction companies that consolidates subcontractor Excel reports into a master record. It has a three-panel layout: sources panel (left), spreadsheet editor (center), AI chat (right). Users upload .xlsx files, select multiple, hit Consolidate, and Claude merges them into one spreadsheet. The app is a single `index.html` with vanilla JS ES modules and no build step.

## This group's role
You are building natural language spreadsheet editing. When a user types a command in the chat ("add a Total column", "remove empty rows", "sort by date"), your code intercepts it, calls Claude to parse the intent, and applies the change to the live spreadsheet.

## Your files
- `js/ai-operations.js` — implement everything here
- `js/chat.js` — modify only if needed for command routing

## Do not touch
`js/state.js`, `js/app.js`, `index.html`, `js/excel-editor.js`, `js/consolidation.js`, `js/master-records.js`, `js/file-ingestion.js`, `css/`

## Key interfaces
- `state.chatCommandHandler` — register your handler here. Receives user message, return `true` if handled, `false` to pass through to normal chat
- `state.excelState.instance` — the live Jspreadsheet CE instance. Use its API to mutate the spreadsheet
- `state.addMessage(text, 'ai')` — post a message to the chat panel
- `state.apiKey` — Anthropic API key (replace `YOUR_KEY_HERE` before testing)
- `/api/chat` — Group 3's backend proxy for Anthropic (use this once backend is ready, use `state.apiKey` directly until then)

## Running locally
```bash
node serve.mjs   # starts server at http://localhost:3000
```
