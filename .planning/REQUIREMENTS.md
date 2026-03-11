# Requirements: WhiteHelmet Reporting Engine

**Defined:** 2026-03-10
**Core Value:** Contractors can submit structured daily reports and project managers can see consolidated master records — eliminating 60+ hours/month of manual reporting

## v1 Requirements

### Template Management

- [ ] **TMPL-01**: Admin can create a new report template with a name and description
- [ ] **TMPL-02**: Admin can define sheet tabs within a template (multiple sheets per template)
- [ ] **TMPL-03**: Admin can define column headers for each sheet (name, data type)
- [ ] **TMPL-04**: Admin can upload an existing .xlsx file to use as a template structure
- [ ] **TMPL-05**: Created templates are persisted to disk and available for contractor use

### Report Submission

- [ ] **SUBM-01**: Contractor can select an available template to fill out
- [ ] **SUBM-02**: Contractor can fill in report data in a spreadsheet-style grid (cell-level entry)
- [ ] **SUBM-03**: Report header captures: contract reference, work order number, submission date, submitter name
- [ ] **SUBM-04**: Contractor can submit the completed report
- [ ] **SUBM-05**: Submitted report is persisted to disk as a JSON file via Node.js backend

### Consolidation

- [ ] **CONS-01**: System automatically consolidates submitted report into the master record for its work package on submit
- [ ] **CONS-02**: Master record aggregates all submitted rows across all reports for a work package

### Review & Management

- [ ] **VIEW-01**: Project Manager can view the consolidated master record for a work package
- [ ] **VIEW-02**: Master record displays aggregated data in a spreadsheet-style table

### Role Navigation

- [ ] **ROLE-01**: UI provides a role switcher to toggle between Contractor, Project Manager, System Admin, and Project Director views
- [ ] **ROLE-02**: Each role sees only the panels/actions relevant to their workflow

### Infrastructure

- [ ] **INFRA-01**: Node.js backend API endpoints handle template storage, report submission, and consolidation
- [ ] **INFRA-02**: Data persisted as JSON files on disk (no database required)
- [ ] **INFRA-03**: Existing three-panel UI shell extended to support reporting workflows

## v2 Requirements

### Report Submission

- **SUBM-06**: Contractor can save a report as draft and return to complete it later
- **SUBM-07**: Multi-sheet reports supported within a single submission
- **SUBM-08**: File attachments can be added to a report submission

### Template Management

- **TMPL-06**: Template versioning — submissions retain the template version they were created with
- **TMPL-07**: Admin can deactivate templates (archived templates no longer available for new submissions)

### Review & Management

- **VIEW-03**: Project Manager can view list of all submitted reports with filter by date / status / work package
- **VIEW-04**: Project Manager can open individual report to review submitted data
- **VIEW-05**: Project Director sees cross-work-package summary view

### Consolidation

- **CONS-03**: Manual consolidation trigger — PM selects date range and work package to re-consolidate
- **CONS-04**: Export consolidated master record to .xlsx

### Notifications

- **NOTF-01**: PM receives notification when new report is submitted for their work package
- **NOTF-02**: Contractor receives confirmation notification after successful submission

## Out of Scope

| Feature | Reason |
|---------|--------|
| Authentication / user accounts | No auth in v1 — role switcher replaces it; auth adds significant complexity |
| Real AI / Asif Chat integration | Separate AI Data Analysis module; mock chat sufficient for v1 |
| GIS / geospatial data integration | Requires external platform integration — future milestone |
| Mobile app | Web-first; mobile is separate milestone |
| WhiteHelmet platform API integration | Standalone only for v1; integration is separate milestone |
| Custom formulas / macros in cells | Excel-like grid only; no formula engine in v1 |
| Real-time collaboration | Single-user submit flow for v1 |
| Historical master record versions | Only current consolidated state retained in v1 |
| Report approval workflow | PM review is view-only in v1; approval/rejection is v2 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| ROLE-01 | Phase 1 | Pending |
| ROLE-02 | Phase 1 | Pending |
| TMPL-01 | Phase 2 | Pending |
| TMPL-02 | Phase 2 | Pending |
| TMPL-03 | Phase 2 | Pending |
| TMPL-04 | Phase 2 | Pending |
| TMPL-05 | Phase 2 | Pending |
| SUBM-01 | Phase 3 | Pending |
| SUBM-02 | Phase 3 | Pending |
| SUBM-03 | Phase 3 | Pending |
| SUBM-04 | Phase 3 | Pending |
| SUBM-05 | Phase 3 | Pending |
| CONS-01 | Phase 4 | Pending |
| CONS-02 | Phase 4 | Pending |
| VIEW-01 | Phase 4 | Pending |
| VIEW-02 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 after initial definition*
