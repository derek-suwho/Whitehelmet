# Whitehelmet — Merge Status

## Branches
- Base: `derek` → `artem` (reset)
- Merge 1: `group2-master` — AI schema mapping, pivot reports ✓
- Merge 2: `ethan` — Auth system ✓
- Merge 3: `srijayTanay` — Formula library, Handsontable fixes ✓

## Branch Feature Summary

| Branch | Key Features |
|--------|-------------|
| `derek` (baseline) | Excel-like theme, Project/Subcontractor/Formula/Admin routes, Render deploy, Alembic migrations, RBAC |
| `group2-master` | AI schema mapping, smart pivot reports, consolidation engine improvements |
| `ethan` | Complete auth system, user-scoped file management, Keycloak-ready flow |
| `srijayTanay` | Formula library, Handsontable operation fixes, Python 3.9 compatibility |

---

## Progress

### Phase 0 — Reset artem to derek
- [x] artem reset to derek
- [x] MERGE_STATUS.md created
- [x] Push to origin

### Phase 1 — Merge group2-master
- [x] Conflict scan complete
- [x] Merged `de9aff8` ("fully finished group2 stuff") — 4 conflicts resolved
- [x] Bug fixes applied post-merge:
  - Modal inputs white-on-white text fixed
  - Emojis replaced with SVG icons site-wide
  - Smart Excel parser (header detection, merged cells, multi-sheet)
  - Import template: single-step upload → redirect to builder
  - AI chat: persistent history (localStorage, 100 msg cap), column context fix
  - Template list scrollable
- [x] Committed and pushed to origin/artem

### Phase 2 — Merge ethan
- [x] Conflict scan complete
- [x] Auth routes merged (`backend/app/api/routes/auth.py`)
- [x] Auth store merged (`frontend/src/stores/auth.ts`)
- [x] Committed and pushed to origin/artem (`2a86f64`)

### Phase 3 — Merge srijayTanay
- [x] Conflict scan complete
- [x] Formula library merged/deduplicated vs derek's existing formula components
- [x] Handsontable fixes applied
- [x] Python 3.9 compat patches applied
- [x] Committed and pushed to origin/artem (`7ccedba`)

### Phase 4 — Fresh-clone verification
- [x] `backend/.env.example` has ALL required environment variables
- [x] `backend/requirements.txt` is pinned and complete
- [x] `frontend/package.json` has all dependencies
- [x] `alembic upgrade head` succeeds on a clean MySQL database
- [x] `./dev.sh` fixed — npm install, alembic migrations, Vite frontend (was broken: called missing `serve.mjs`)
- [x] `deploy/docker/backend.Dockerfile` — added `entrypoint.sh` to run alembic before uvicorn
- [x] README rewritten — documents docker-compose and dev.sh paths clearly
- [x] Smoke test: health endpoint returns `{"status":"ok"}`, alembic runs clean
- [x] Note: 2 non-critical Pydantic warnings (`schema_json` field name shadow) — do not affect runtime

---

## Conflict Resolution Notes
<!-- Add decisions made during conflict resolution here as work progresses -->

### Phase 1 (group2-master) decisions
- Models strategy: keep derek's full model set (Project, Submission, Formula, TemplateAssignment) + add group2-master-only additions
- Routes strategy: union of all routes, no removals
- Auth strategy: use derek's version (more complete RBAC)
- CSS strategy: concatenate additions from both sides

### Phase 2 (ethan) decisions
- Merged template sheet preview, dark inputs, admin layout fixes
- Auth store and routes integrated; Keycloak wiring deferred to production config

### Phase 3 (srijayTanay) decisions
- Formula library deduplicated against derek's existing formula components
- AI provider fallback included
- Python 3.9 compatibility patches applied
