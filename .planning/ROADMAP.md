# Roadmap: Whitehelmet

## Overview

Six phases deliver the full AI-powered consolidation engine. The app shell and layout come first to provide the frame. File ingestion and the embedded Excel editor follow as the two foundational components. AI consolidation layers on top of both. AI chat operations extend consolidation with natural language restructuring. Master records close the loop with a dashboard of completed reports.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: App Shell** - Three-panel NotebookLM-style layout and chat UI frame
- [ ] **Phase 2: File Ingestion** - Upload, bulk-add, and source file management in left panel
- [ ] **Phase 3: Excel Editor** - Embedded in-browser spreadsheet with read/write editing and download
- [ ] **Phase 4: AI Consolidation** - AI merges multiple sub .xlsx files into a master record
- [ ] **Phase 5: AI Chat Operations** - Natural language template restructuring and data operations
- [ ] **Phase 6: Master Records** - Dashboard, auto-generated metadata, aggregated record views

## Phase Details

### Phase 1: App Shell
**Goal**: Users can see and navigate the complete three-panel interface
**Depends on**: Nothing (first phase)
**Requirements**: UI-01, UI-02
**Success Criteria** (what must be TRUE):
  1. Three-panel layout renders: sources panel on left, Excel area in center, chat panel on right
  2. Chat panel shows an input field and message history area
  3. Layout is stable and does not collapse or overflow at standard desktop viewport
**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md — Three-panel layout shell with sources, Excel placeholder, and chat panels
- [ ] 01-02-PLAN.md — Chat UI with message input, send action, and scrollable history

### Phase 2: File Ingestion
**Goal**: Users can upload and view all source .xlsx files in the left panel
**Depends on**: Phase 1
**Requirements**: FILE-01, FILE-02, FILE-03
**Success Criteria** (what must be TRUE):
  1. User can drag-and-drop one or more .xlsx files onto the sources panel and see them listed
  2. User can open a file picker to select individual .xlsx files for upload
  3. User can drop an entire folder and all .xlsx files within it are ingested
  4. Each uploaded file appears in the left panel with its file name and metadata (size, date)
**Plans**: TBD

Plans:
- [ ] 02-01: Implement drag-and-drop and file picker upload for single .xlsx files
- [ ] 02-02: Add folder drop support for bulk-upload of all .xlsx files within a folder
- [ ] 02-03: Build sources panel list with file name and metadata display

### Phase 3: Excel Editor
**Goal**: Users can view and directly edit spreadsheet data in the browser and download the result
**Depends on**: Phase 1
**Requirements**: EXCEL-01, EXCEL-02
**Success Criteria** (what must be TRUE):
  1. An Excel-compatible spreadsheet renders in the center panel with rows, columns, and cell values
  2. User can click any cell and type to edit its value directly in the browser
  3. User can download the current spreadsheet state as a valid .xlsx file
**Plans**: TBD

Plans:
- [ ] 03-01: Integrate embedded in-browser spreadsheet library with full read/write cell editing
- [ ] 03-02: Implement .xlsx export and download of the current spreadsheet state

### Phase 4: AI Consolidation
**Goal**: AI can merge multiple uploaded sub reports into a single master Excel record
**Depends on**: Phase 2, Phase 3
**Requirements**: AI-01, AI-04
**Success Criteria** (what must be TRUE):
  1. User can trigger AI consolidation on a set of uploaded source files and a merged master appears in the Excel editor
  2. The consolidated master contains data drawn from all contributing source files
  3. AI chat maintains conversation history so follow-up messages have context from prior turns
**Plans**: TBD

Plans:
- [ ] 04-01: Implement AI consolidation pipeline (send source files to Claude, receive merged output, render in editor)
- [ ] 04-02: Wire chat session history so conversation context persists across messages within a session

### Phase 5: AI Chat Operations
**Goal**: Users can restructure templates and perform data operations through natural language chat
**Depends on**: Phase 4
**Requirements**: AI-02, AI-03
**Success Criteria** (what must be TRUE):
  1. User can type a chat message to add or remove columns and the Excel editor updates accordingly
  2. User can type a chat message to change column layout or modify a formula and the change applies in the editor
  3. User can type a chat message to merge rows, filter data, aggregate values, or fill cells from source files and the result appears in the editor
**Plans**: TBD

Plans:
- [ ] 05-01: Implement AI template restructuring operations (columns, layout, formulas) via chat
- [ ] 05-02: Implement AI data operations (merge rows, filter, aggregate, fill from sources) via chat

### Phase 6: Master Records
**Goal**: Users can browse a dashboard of all consolidated reports with auto-generated metadata
**Depends on**: Phase 4
**Requirements**: MSTR-01, MSTR-02, MSTR-03
**Success Criteria** (what must be TRUE):
  1. Every completed consolidation automatically generates a master record with report name, type, source files, contributing users, and date
  2. A dashboard view lists all master records and user can open any record
  3. Each master record displays aggregated metadata summarizing the contributing sub reports
**Plans**: TBD

Plans:
- [ ] 06-01: Auto-generate master record metadata on consolidation completion
- [ ] 06-02: Build master records dashboard with list view and record open/navigation
- [ ] 06-03: Display aggregated sub-report metadata within each master record view

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. App Shell | 0/2 | Not started | - |
| 2. File Ingestion | 0/3 | Not started | - |
| 3. Excel Editor | 0/2 | Not started | - |
| 4. AI Consolidation | 0/2 | Not started | - |
| 5. AI Chat Operations | 0/2 | Not started | - |
| 6. Master Records | 0/3 | Not started | - |
