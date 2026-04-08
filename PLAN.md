# MVP → Production Transition — Progress Tracker

## Phase 0: Secret Rotation — DONE
- [x] Verified `.env` never committed to git history
- [x] Pre-commit hook blocks key patterns (`.githooks/pre-commit`)
- [x] Git configured to use `.githooks/` dir
- [ ] **MANUAL:** Rotate OpenRouter key via dashboard
- [ ] **MANUAL:** Rotate Supabase keys (anon + service role)

## Phase 1: Backend (FastAPI) — SCAFFOLDED
All files in `backend/`.

### Done
- [x] `app/main.py` — FastAPI entry, CORS, route registration
- [x] `app/core/config.py` — pydantic-settings, all config from env vars
- [x] `app/core/security.py` — session tokens (128-bit), CSRF, file hashing
- [x] `app/core/dependencies.py` — auth middleware, CSRF verification
- [x] `app/api/routes/health.py` — `/health` + `/ready` (K8s probes)
- [x] `app/api/routes/auth.py` — login/logout/me (login stub until auth type confirmed)
- [x] `app/api/routes/ai.py` — `/api/ai/chat` (SSE), `/api/ai/consolidate`, `/api/ai/command`
- [x] `app/api/routes/records.py` — full CRUD, user-scoped
- [x] `app/api/routes/files.py` — xlsx upload with validation (extension, size, magic bytes, sha256)
- [x] `app/schemas/` — Pydantic models for all endpoints
- [x] `requirements.txt`, `pyproject.toml` (ruff, pytest, bandit config)
- [x] `.env.example` — template with all required env vars
- [x] Test scaffolding: `conftest.py` with SQLite test DB, auth fixtures
- [x] Tests: health, records CRUD, security utils

### Not done
- [ ] Rate limiting (5 failed login attempts)
- [ ] Redis session store (currently DB-only)
- [ ] Actual auth service integration (blocked on auth type)

## Phase 2: Database (MySQL) — SCAFFOLDED
- [x] SQLAlchemy models: `users`, `records`, `uploaded_files`, `conversation_history`, `sessions`
- [x] `app/db/session.py` — engine with connection pooling
- [x] Alembic setup: `alembic.ini`, `migrations/env.py`, `script.py.mako`
- [ ] Generate initial migration (`alembic revision --autogenerate`)
- [ ] Remove all Supabase references from MVP code

## Phase 3: Frontend (Vue 3 + Vite + TS) — PARTIALLY SCAFFOLDED
All files in `frontend/`.

### Done
- [x] `package.json` — Vue 3, Pinia, vue-router, jspreadsheet-ce, xlsx, Vite, Vitest, Playwright
- [x] Vite config with API proxy to backend, manual chunks
- [x] Tailwind + PostCSS (npm, build-time — no CDN eval)
- [x] TypeScript strict config
- [x] `src/main.ts` — app entry with Pinia + router
- [x] `src/App.vue` — root layout
- [x] `src/router/index.ts` — routes with auth guards (login, workspace, dashboard)
- [x] `src/stores/auth.ts` — Pinia auth store (login, logout, session check, CSRF)
- [x] `src/stores/spreadsheet.ts` — Pinia store wrapping Jspreadsheet instance

### Not done
- [ ] Remaining Pinia stores: chat, records, sources
- [ ] Composables: `useApi`, `useConsolidation`, `useAiOperations`
- [ ] Components: `TopBar`, `ChatPanel`, `SpreadsheetEditor`, `SourcesPanel`, `DashboardView`
- [ ] Views: `LoginView`, `WorkspaceView`, `DashboardView`
- [ ] Port all MVP vanilla JS logic to Vue components
- [ ] `npm install` + verify build

## Phase 4: Auth Integration — BLOCKED
- [x] Backend auth route stubbed
- [x] Frontend auth store + router guards
- [ ] **BLOCKED:** Awaiting auth system type (OAuth2? SAML? LDAP?)

## Phase 5: Docker + K8s — NOT STARTED
- [ ] Frontend Dockerfile (multi-stage: node build → nginx)
- [ ] Backend Dockerfile (python slim + uvicorn)
- [ ] K8s manifests (Deployment, Service, Ingress, ConfigMap, Secret, HPA)
- [ ] 4 environment overlays (dev, staging, bribrot, production)
- [ ] Directory structure created: `deploy/docker/`, `deploy/k8s/`

## Phase 6: GitLab CI/CD — NOT STARTED
- [ ] `.gitlab-ci.yml` with 8 mandatory gates
- [ ] Branch protection rules
- [ ] Migrate from GitHub to GitLab

## Phase 7: Testing — PARTIALLY STARTED
- [x] Backend: pytest + conftest with test DB + 3 test files
- [ ] Backend: reach 80% coverage
- [ ] Frontend: Vitest + Vue Test Utils setup
- [ ] Frontend: reach 70% coverage
- [ ] E2E: Playwright setup

---

## Unresolved Questions (from plan)
1. Backend language? Plan recommends Python/FastAPI — **scaffolded as FastAPI**
2. Auth system type? OAuth2, SAML, LDAP? — **BLOCKING Phase 4**
3. What is "Bribrot" environment?
4. File storage: local PV or Oracle Object Storage?
5. Oracle Cloud specifics: OKE? Managed MySQL?
6. GitLab: self-hosted or gitlab.com?
7. Data residency: spreadsheet data sent to US AI APIs — restrictions?
8. Jspreadsheet CE GPL license — legal review needed
9. Max xlsx upload size? (defaulted to 50MB)
10. VPN/BAM onboarding timeline?
11. Conversation history persistence — confirmed in schema
12. OpenRouter vs direct Anthropic? Backend proxy supports both
