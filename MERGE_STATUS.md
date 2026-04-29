# Whitehelmet — Merge Status

## Branches
- Base: `derek` → `artem` (reset)
- Merge 1: `group2-master` — AI schema mapping, pivot reports
- Merge 2: `ethan` — Auth system (pending user instruction)
- Merge 3: `srijayTanay` — Formula library, Handsontable fixes (pending user instruction)

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

### Phase 2 — Merge ethan (start when instructed)
- [ ] Conflict scan complete
- [ ] Auth routes merged (`backend/app/api/routes/auth.py`)
- [ ] Auth store merged (`frontend/src/stores/auth.ts`)
- [ ] Backend tests pass
- [ ] Committed and pushed to origin/artem

### Phase 3 — Merge srijayTanay (start when instructed)
- [ ] Conflict scan complete
- [ ] Formula library merged/deduplicated vs derek's existing formula components
- [ ] Handsontable fixes applied
- [ ] Python 3.9 compat patches applied
- [ ] Backend tests pass
- [ ] Committed and pushed to origin/artem

### Phase 4 — Fresh-clone verification (after all merges complete)
- [ ] `backend/.env.example` has ALL required environment variables
- [ ] `backend/requirements.txt` is pinned and complete
- [ ] `frontend/package.json` has all dependencies
- [ ] `alembic upgrade head` succeeds on a clean empty database
- [ ] `./dev.sh` starts both services without manual steps
- [ ] README documents full setup flow
- [ ] Full smoke test passed on clean environment

---

## Conflict Resolution Notes
<!-- Add decisions made during conflict resolution here as work progresses -->

### Phase 1 (group2-master) decisions
- Models strategy: keep derek's full model set (Project, Submission, Formula, TemplateAssignment) + add group2-master-only additions
- Routes strategy: union of all routes, no removals
- Auth strategy: use derek's version (more complete RBAC)
- CSS strategy: concatenate additions from both sides

### Phase 2 (ethan) decisions
<!-- Fill in when merging ethan -->

### Phase 3 (srijayTanay) decisions
<!-- Fill in when merging srijayTanay -->
