# Roadmap: WhiteHelmet Reporting Engine

## Overview

Four phases that build the complete reporting loop: first establish the backend API and role-aware UI shell, then let admins create templates, then let contractors fill and submit reports, then close the loop with auto-consolidation and PM review. Each phase delivers a coherent, verifiable capability that unblocks the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Node.js backend API, JSON file storage, UI shell extended with role switcher
- [ ] **Phase 2: Template Management** - Admin can create, configure, and persist report templates
- [ ] **Phase 3: Report Submission** - Contractor can select a template, fill the grid, and submit a report
- [ ] **Phase 4: Consolidation and Review** - Reports auto-consolidate per work package; PM sees master record

## Phase Details

### Phase 1: Foundation
**Goal**: The backend API handles file I/O and the UI shell supports role-based navigation — making all subsequent workflows possible
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, ROLE-01, ROLE-02
**Success Criteria** (what must be TRUE):
  1. Node.js server handles API requests for template storage and report submission (not just static file serving)
  2. Data written by the server appears as JSON files on disk in the correct directory structure
  3. The three-panel UI shell renders without breaking existing Sources, Excel Editor, and AI Chat panels
  4. A role switcher control is visible and selecting a role changes which panels and actions are displayed
  5. Each role (Contractor, Project Manager, System Admin, Project Director) shows a distinct, appropriate view
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Extend serve.mjs into REST API server with JSON file persistence (INFRA-01, INFRA-02)
- [ ] 01-02-PLAN.md — Add role switcher and CSS role-visibility to index.html (INFRA-03, ROLE-01, ROLE-02)
- [ ] 01-03-PLAN.md — Human verification checkpoint for complete Phase 1 foundation

### Phase 2: Template Management
**Goal**: An admin can create a report template with named sheets and typed column headers, and that template is available for contractors to use
**Depends on**: Phase 1
**Requirements**: TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05
**Success Criteria** (what must be TRUE):
  1. Admin can create a new template by entering a name and description through the UI
  2. Admin can define multiple named sheet tabs within a template
  3. Admin can define column headers with data types for each sheet
  4. Admin can upload an .xlsx file and have its sheet/column structure used as the template
  5. Created templates appear in the contractor's template selection list after page refresh
**Plans**: TBD

### Phase 3: Report Submission
**Goal**: A contractor can open a template, fill in report data in a spreadsheet-style grid with correct header fields, and submit — with the result persisted to disk
**Depends on**: Phase 2
**Requirements**: SUBM-01, SUBM-02, SUBM-03, SUBM-04, SUBM-05
**Success Criteria** (what must be TRUE):
  1. Contractor can select an available template and see a spreadsheet grid matching its sheet/column structure
  2. Contractor can enter data cell-by-cell in the grid
  3. Report header captures contract reference, work order number, submission date, and submitter name before submission
  4. Contractor can submit the completed report and receives confirmation
  5. Submitted report appears as a JSON file on disk containing all entered data and header fields
**Plans**: TBD

### Phase 4: Consolidation and Review
**Goal**: Submitted reports are automatically merged into a per-work-package master record, and the project manager can view that consolidated data in the spreadsheet panel
**Depends on**: Phase 3
**Requirements**: CONS-01, CONS-02, VIEW-01, VIEW-02
**Success Criteria** (what must be TRUE):
  1. Submitting a report immediately updates the master record for its work package without any manual trigger
  2. The master record contains aggregated rows from all submitted reports for that work package
  3. Project Manager can select a work package and see the consolidated master record
  4. Master record is displayed as a spreadsheet-style table in the Excel Editor panel
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/3 | Not started | - |
| 2. Template Management | 0/TBD | Not started | - |
| 3. Report Submission | 0/TBD | Not started | - |
| 4. Consolidation and Review | 0/TBD | Not started | - |
