# Whitehelmet

## What This Is

A web-based AI-powered reporting engine for construction companies that consolidates subcontractor Excel reports into master records. Features a NotebookLM-style interface with a sources panel, embedded editable Excel view, and AI chat — enabling project teams to ingest, merge, restructure, and review construction reports through natural language.

## Core Value

Project teams can consolidate dozens of subcontractor Excel reports into a single master record through AI-assisted merging and natural language commands, eliminating manual copy-paste across spreadsheets.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Upload and manage .xlsx source files (drag-and-drop + file picker)
- [ ] Connect shared drives/folders that auto-sync new files
- [ ] AI-powered consolidation of multiple sub reports into a master Excel template
- [ ] Embedded in-browser Excel editor (full read/write editing)
- [ ] AI chat that can restructure templates (add/remove columns, change layout, modify formulas)
- [ ] AI chat that can perform data operations (merge rows, filter, aggregate, fill from sources)
- [ ] System-generated master records (report name, type, source, users, date)
- [ ] Online preview of consolidated reports for review
- [ ] NotebookLM-style three-panel layout (sources | Excel | chat)
- [ ] Multi-role access (PM, Reporting Analyst, Director, Client Rep)

### Out of Scope

- Approval workflows — deferred, not needed for v1
- PDF/CSV ingestion — .xlsx only for v1
- Mobile app — web-first
- Real-time collaboration (multi-user editing same document simultaneously)

## Context

- Built for an AI construction company's internal and client-facing reporting needs
- Subcontractors submit .xlsx reports across work packages — currently consolidated manually
- Reports vary in structure (no consistent schema) but typically under 100 rows/columns each
- Volume: dozens to 50+ Excel files per consolidated report
- Users: Project Managers, Reporting Analysts, Project Directors, Client Representatives
- AI backend: Claude/Anthropic API

## Constraints

- **AI Provider**: Claude/Anthropic — selected by stakeholder
- **File Format**: .xlsx only for v1 — most common format from subcontractors
- **Platform**: Web application — browser-based, accessible anywhere
- **Excel Editing**: Must support full in-browser cell editing, not just read-only preview

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Claude/Anthropic for AI | Stakeholder preference | — Pending |
| .xlsx only for v1 | Most common sub format, reduces scope | — Pending |
| NotebookLM-style layout | Three-panel UX matches workflow (sources → Excel → AI) | — Pending |
| No approval workflow v1 | User deprioritized, reduces scope | — Pending |
| Full Excel editing in browser | Users need direct cell editing, not AI-only | — Pending |

---
*Last updated: 2026-03-10 after initialization*
