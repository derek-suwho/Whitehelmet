# Directory Structure

**Analyzed:** 2026-03-17

---

## Root Layout

```
Whitehelmet/
├── index.html              # Single HTML entry point — loads all CDN libs + app.js
├── js/                     # All application logic (ES modules)
│   ├── app.js              # Orchestrator: init order, module wiring
│   ├── state.js            # Shared state singleton
│   ├── chat.js             # Chat panel + Anthropic API calls
│   ├── excel-editor.js     # Jspreadsheet wrapper, download
│   ├── file-ingestion.js   # File upload, source panel, SheetJS parsing
│   ├── consolidation.js    # AI-driven multi-file merge
│   ├── ai-operations.js    # [STUB] Natural language ops (Phase 5)
│   └── master-records.js   # [STUB] Report dashboard (Phase 6)
├── css/                    # Stylesheets
│   ├── base.css            # Reset, variables, typography
│   ├── layout.css          # Three-panel grid layout
│   ├── panels.css          # Per-panel styles
│   └── components.css      # Buttons, inputs, chat bubbles
├── serve.mjs               # Dev server (Node.js, no deps)
├── screenshot.mjs          # Puppeteer screenshot utility
├── package.json            # Only dev deps: serve, puppeteer
├── package-lock.json
├── CLAUDE.md               # AI assistant instructions (group-specific)
├── INSTRUCTIONS.md         # Human-readable project overview
├── TECH_STACK.txt          # Full technical reference document
└── .planning/              # GSD planning artifacts
    ├── PROJECT.md
    ├── ROADMAP.md
    ├── REQUIREMENTS.md
    ├── STATE.md
    ├── config.json
    ├── phases/
    │   ├── 01-app-shell/
    │   ├── 02-file-ingestion/
    │   ├── 03-excel-editor/
    │   └── 04-ai-consolidation/
    └── codebase/           # This codebase map
```

---

## Naming Conventions

| Pattern | Example |
|---------|---------|
| JS modules | `kebab-case.js` |
| Init functions | `initModuleName()` |
| State keys | `camelCase` on `state` object |
| CSS files | `kebab-case.css`, one concern per file |
| Planning phases | `NN-phase-name/` (zero-padded number) |
| Plan files | `NN-MM-PLAN.md`, `NN-MM-SUMMARY.md` |

---

## Key File Locations

| What | Where |
|------|-------|
| App entry point | `index.html` |
| Module orchestrator | `js/app.js` |
| Shared state | `js/state.js` |
| Chat command hook | `state.chatCommandHandler` (set in `js/ai-operations.js`) |
| Spreadsheet instance | `state.excelState.instance` |
| Dev server | `serve.mjs` |
| Group 1 work file | `js/ai-operations.js` |
| Group 2 work file | `js/master-records.js` |
| Roadmap | `.planning/ROADMAP.md` |
| Project context | `.planning/PROJECT.md` |
