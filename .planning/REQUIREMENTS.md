# Requirements: Whitehelmet

**Defined:** 2026-03-10
**Core Value:** Project teams can consolidate dozens of subcontractor Excel reports into a single master record through AI-assisted merging and natural language commands.

## v1 Requirements

### File Management

- [x] **FILE-01**: User can upload individual .xlsx files via drag-and-drop or file picker
- [ ] **FILE-02**: User can drop an entire folder to bulk-upload all .xlsx files within it
- [x] **FILE-03**: User can view all uploaded source files in left panel with file name and metadata

### AI Engine

- [ ] **AI-01**: AI consolidates multiple sub .xlsx files into a single master Excel template
- [ ] **AI-02**: User can instruct AI via chat to modify template structure (add/remove columns, change layout, modify formulas)
- [ ] **AI-03**: User can instruct AI via chat to perform data operations (merge rows, filter, aggregate, fill from sources)
- [ ] **AI-04**: AI chat maintains conversation history within a session

### Excel View

- [x] **EXCEL-01**: Embedded in-browser spreadsheet editor with full read/write cell editing
- [x] **EXCEL-02**: User can download master record as .xlsx file

### Master Records

- [ ] **MSTR-01**: System auto-generates master records with report name, type, source, users, and date
- [ ] **MSTR-02**: Dashboard/list view showing all consolidated master records
- [ ] **MSTR-03**: Master records display aggregated metadata from contributing sub reports

### UI/Layout

- [x] **UI-01**: Three-panel NotebookLM-style layout (sources left | Excel center | chat right)
- [x] **UI-02**: Right panel AI chat interface with message history

## v2 Requirements

### Authentication

- **AUTH-01**: User can log in with email and password
- **AUTH-02**: Role-based access control (PM, Analyst, Director, Client)
- **AUTH-03**: Admin can add/remove users and assign roles

### File Management

- **FILE-04**: User can connect shared drive/folder that auto-syncs new files

### UI

- **UI-03**: Responsive design for tablet/smaller screens

## Out of Scope

| Feature | Reason |
|---------|--------|
| Approval workflows | User deprioritized, not needed for v1 |
| PDF/CSV ingestion | .xlsx only for v1, most common sub format |
| Mobile app | Web-first approach |
| Real-time multi-user collaboration | High complexity, defer to future |
| Online preview (separate from editor) | Editor serves as preview |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| UI-01 | Phase 1 | Complete |
| UI-02 | Phase 1 | Complete |
| FILE-01 | Phase 2 | Complete |
| FILE-02 | Phase 2 | Pending |
| FILE-03 | Phase 2 | Complete |
| EXCEL-01 | Phase 3 | Complete |
| EXCEL-02 | Phase 3 | Complete |
| AI-01 | Phase 4 | Pending |
| AI-04 | Phase 4 | Pending |
| AI-02 | Phase 5 | Pending |
| AI-03 | Phase 5 | Pending |
| MSTR-01 | Phase 6 | Pending |
| MSTR-02 | Phase 6 | Pending |
| MSTR-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 after roadmap creation*
