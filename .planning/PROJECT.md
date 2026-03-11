# WhiteHelmet Reporting Engine

## What This Is

WhiteHelmet Reporting Engine is a standalone production MVP that enables construction contractors to submit structured daily reports using a spreadsheet-style interface. System admins configure report templates; contractors fill and submit reports against work packages; project managers and directors review auto-consolidated master records. Built on top of the existing WhiteHelmet three-panel UI.

## Core Value

Contractors can submit a structured daily report and project managers can see it consolidated — eliminating the 60+ hours/month of manual copy-paste reporting that creates stale, error-prone data.

## Requirements

### Validated

- ✓ Three-panel UI shell (Sources, Excel Editor, AI Chat panels) — existing
- ✓ Construction-themed design system (concrete/steel/amber palette) — existing
- ✓ Mock AI chat interaction (client-side, 500ms response) — existing
- ✓ File drop zone UI structure — existing
- ✓ Dev server (serve.mjs on port 3000) — existing
- ✓ Screenshot automation utility (screenshot.mjs) — existing

### Active

- [ ] Admin can create and configure report templates (multi-sheet, structured headers)
- [ ] Contractor can open a template and fill in report data in a spreadsheet-style grid
- [ ] Contractor can submit a completed report associated with a work order number
- [ ] Submitted reports persist to disk via Node.js file backend (JSON)
- [ ] System auto-consolidates submitted reports into a master record per work package
- [ ] Project Manager can view list of submitted reports (filterable by date/status)
- [ ] Project Manager can view consolidated master record for a work package
- [ ] Project Director can see cross-work-package summary view
- [ ] UI adapts to show correct view based on selected role (no auth — role switcher)
- [ ] Report headers capture contract reference, work order number, submission date
- [ ] Multi-sheet reports supported within a single submission

### Out of Scope

- Authentication / user accounts — no auth in v1, role switcher instead
- Real AI integration (Asif Chat stays as mock in v1) — high complexity, separate module
- GIS / geospatial data integration — requires external platform
- Mobile app — web-first
- Integration with broader WhiteHelmet platform APIs — standalone only for now
- Custom formulas / macros in spreadsheet cells — Excel-like interface only
- Real-time collaboration — single-user submit flow for v1
- Notification system — v2

## Context

- **Existing codebase:** `Whitehelmet/index.html` (739 lines) — monolithic SPA with all HTML/CSS/JS inline. No build pipeline, no framework, vanilla JS + Tailwind CSS CDN.
- **Reference data:** `resources/` contains real NEOM/QHSE KPI Excel files, daily progress reports, and product documentation (Reporting Engine + AI Data Analysis overviews).
- **Codebase map:** `.planning/codebase/` has full analysis (STACK, ARCHITECTURE, STRUCTURE, CONVENTIONS, CONCERNS, INTEGRATIONS, TESTING).
- **Domain:** Construction project management — NEOM giga-projects context. Users are project engineers, planning teams, executive directors.
- **Product docs:** WhiteHelmet has detailed product specs for Reporting Engine (16 features) and AI Data Analysis (12 features) in `resources/`.

## Constraints

- **Tech stack:** Vanilla JS + HTML + CSS, Node.js backend, no framework — keep consistent with existing codebase
- **No build pipeline:** Must work without Webpack/Vite; ES modules only
- **Standalone:** No external API dependencies in v1
- **File backend:** Reports stored as JSON files on disk via Node.js (not a database)
- **No auth:** Single interface with role switcher to toggle between Contractor / PM / Admin / Director views

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep existing 3-panel UI | Already styled and construction-themed; build on top | — Pending |
| File backend (JSON on disk) | Simplest persistence without DB setup; sufficient for MVP | — Pending |
| No authentication | Role switcher keeps v1 simple; auth adds significant complexity | — Pending |
| Vanilla JS (no framework) | Consistent with existing codebase; avoids build pipeline | — Pending |
| Standalone (no platform integration) | Faster to ship; integration is separate milestone | — Pending |

---
*Last updated: 2026-03-10 after initialization*
