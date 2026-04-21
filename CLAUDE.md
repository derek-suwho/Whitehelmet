# Whitehelmet

## Product Vision
Whitehelmet is a multi-tenant QHSE KPI reporting and consolidation platform. The primary use case is **PIF (Public Investment Fund)** and its portfolio companies (DevCos): PIF defines standardized KPI templates, DevCos submit data monthly, and Whitehelmet auto-applies PIF-owned calculation formulas and consolidates all submissions into a master KPI sheet.

The product must meet **enterprise/government standards**: multi-tenant data isolation, role-based access, structured submission workflows, audit trails, and locked/timestamped submissions.

## Current State (as of 2026-04)
The MVP is a single-user spreadsheet consolidation tool with:
- 3-panel layout: sources (left), spreadsheet editor (center), AI chat (right)
- Upload .xlsx files → AI consolidates into master spreadsheet
- NL spreadsheet commands (25+ operation types) via chat
- Master records dashboard (save/load consolidations)
- FastAPI backend + MySQL + Vue 3 frontend + Docker/K8s deployment

## Target State (PIF Use Case)
Six phases of work to reach PIF-grade:

**Phase 1 — Multi-tenant Foundation** (BLOCKER)
- `organizations` table; PIF as root org, DevCos as members
- Roles: `pif_admin`, `devco_admin`, `devco_user`
- All data scoped to org; complete auth (SAML/OAuth2 SSO likely required for PIF)

**Phase 2 — Template Engine**
- PIF creates versioned KPI templates (fields, validation rules, required flags)
- Templates assigned to DevCos; spreadsheet editor is the template-building UI

**Phase 3 — Submission Workflow**
- DevCos fill assigned templates and submit (structured, not ad-hoc uploads)
- On submit: lock data, timestamp, prevent edits; full submission history

**Phase 4 — Formula & Calculation Engine**
- PIF configures QHSE calculation formulas centrally (no code changes)
- Formulas auto-applied to each DevCo submission on submit

**Phase 5 — Auto-Consolidation & Master Sheet**
- On-demand or auto-triggered: pull all submissions for a period, apply formulas, generate master KPI sheet (one row per DevCo)
- Extends existing AI consolidation engine

**Phase 6 — Audit, Reporting & QHSE Output**
- Audit log for all actions (template publish, submission, formula change)
- PIF dashboard: submission status per DevCo per period
- Export master sheet; QHSE Indexes integration (auto-push or manual review)

## Architecture
- **Legacy MVP:** `index.html` + vanilla JS ES modules, no build step, `node serve.mjs` on port 3000
- **Production:** Vue 3 + TypeScript (`frontend/`) + FastAPI (`backend/`) + MySQL + Docker Compose + K8s (Kustomize overlays)
- **AI:** Anthropic API proxied via `/api/ai/chat`, `/api/ai/consolidate`, `/api/ai/command`

## Key Files (Legacy MVP)
- `js/ai-operations.js` — NL spreadsheet command handler (25+ ops)
- `js/excel-editor.js` — Jspreadsheet CE wrapper
- `js/consolidation.js` — multi-file AI merge
- `js/master-records.js` — saved records dashboard
- `js/state.js` — shared singleton state (do not break its interface)
- `js/chat.js` — chat UI + streaming

## Running Locally
```bash
node serve.mjs   # http://localhost:3000
```

## Auth Integration (confirmed 2026-04-18)

**Infrastructure aligned** (from prior call):
- Oracle Cloud, Riyadh region (data residency)
- Docker + Kubernetes, MySQL, GitLab CI/CD — all match our stack
- 4 environments: Dev, Staging, Bribrot, Production — matches K8s Kustomize overlays
- VPN required; user accounts + creds via engineering manager (Slack)

**Auth: Keycloak (confirmed)**
- They use Keycloak as centralized identity provider; single token grants access to all products
- They already have a login page — we redirect unauthenticated users there, do not build our own
- Protocol: **OAuth2/OIDC**
- JWT fields available: `sub` (external_id), `email`, `preferred_username`, custom claims
- Token lifecycle (expiry/refresh) managed by Keycloak

**Integration approach for Phase 1:**
- Replace stub at `backend/app/api/routes/auth.py:17-47` with Keycloak token validation middleware
- Frontend redirects unauthenticated users to Keycloak login (not our UI)
- Backend validates Bearer tokens against Keycloak public key or introspection endpoint
- Map Keycloak roles → `pif_admin / devco_admin / devco_user`

**Still unknown — must get from next contact:**

| Question | Why it matters |
|---|---|
| Orgs/tenants as Keycloak realms or custom claims? | Determines whether we build `organizations` table or inherit from Keycloak |
| What roles exist in their Keycloak today? | Map to our role model |
| Keycloak server URL (dev env)? | Required to test integration |
| PKCE flow (frontend) or client credentials (backend-to-backend)? | Determines auth flow implementation |

**Critical open question:** Realm per org vs. custom claims — determines ~60% of Phase 1 architecture.

## Non-Negotiables for PIF
- Data isolation between orgs is absolute — no cross-org data leakage
- Submissions must be locked and timestamped on submit; no post-submit edits without explicit audit entry
- All calculation logic configurable by PIF without code changes
- Auth must support SSO (SAML or OAuth2); no password-only auth for production
- Full audit trail on all data mutations
