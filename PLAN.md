# MVP → Production Transition — Progress Tracker

## Phase 0: Secret Rotation — DONE
- [x] Verified `.env` never committed to git history
- [x] Pre-commit hook blocks key patterns (`.githooks/pre-commit`)
- [x] Git configured to use `.githooks/` dir
- [ ] **MANUAL:** Rotate OpenRouter key via dashboard
- [ ] **MANUAL:** Rotate Supabase keys (anon + service role)

## Phase 1: Backend (FastAPI) — DONE
All files in `backend/`.

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
- [x] Tests: conftest, health, records CRUD, security utils
- [ ] Rate limiting (5 failed login attempts)
- [ ] Redis session store (currently DB-only)
- [ ] Actual auth service integration (blocked on auth type)

## Phase 2: Database (MySQL) — DONE
- [x] SQLAlchemy models: `users`, `records`, `uploaded_files`, `conversation_history`, `sessions`
- [x] `app/db/session.py` — engine with connection pooling
- [x] Alembic setup: `alembic.ini`, `migrations/env.py`, `script.py.mako`
- [ ] Generate initial migration (`alembic revision --autogenerate`) — needs running MySQL
- [ ] Remove all Supabase references from MVP code

## Phase 3: Frontend (Vue 3 + Vite + TS) — DONE
All files in `frontend/`. **Build verified: `vue-tsc` + `vite build` pass clean.**

### Infrastructure
- [x] `package.json` — all deps, Vite, Vitest, Playwright, Tailwind npm
- [x] Vite config with API proxy to backend, manual chunks (vendor + spreadsheet)
- [x] Tailwind + PostCSS (npm build-time — no CDN eval)
- [x] TypeScript strict config with project references

### Stores (Pinia — replaces `state.js` singleton)
- [x] `stores/auth.ts` — login, logout, session check, CSRF token
- [x] `stores/spreadsheet.ts` — Jspreadsheet instance + SheetJS workbook
- [x] `stores/chat.ts` — messages, SSE streaming, addMessage
- [x] `stores/records.ts` — CRUD mapped to `/api/records`
- [x] `stores/sources.ts` — file/folder management, checkboxes, dedup

### Composables (replace direct API calls)
- [x] `composables/useApi.ts` — fetch wrapper, CSRF, credentials, ApiError
- [x] `composables/useConsolidation.ts` — xlsx parse → backend proxy → synthetic file
- [x] `composables/useAiOperations.ts` — NL command → backend → Jspreadsheet mutation

### Components
- [x] `components/layout/TopBar.vue` — nav bar with records button + user info
- [x] `components/sources/SourcesPanel.vue` — left panel, drag-drop, file list, consolidate btn
- [x] `components/editor/SpreadsheetEditor.vue` — center panel, Jspreadsheet wrapper
- [x] `components/chat/ChatPanel.vue` — right panel, streaming chat, command interception

### Views
- [x] `views/LoginView.vue` — auth form with validation
- [x] `views/WorkspaceView.vue` — 3-panel layout (responsive)
- [x] `views/DashboardView.vue` — records grid with delete

### Types
- [x] `types/index.ts` — ChatMessage, MasterRecord, Source, AiOperation, etc.

## Phase 4: Auth Integration — BLOCKED
- [x] Backend auth route stubbed
- [x] Frontend auth store + router guards
- [ ] **BLOCKED:** Awaiting auth system type (OAuth2? SAML? LDAP?)

## Phase 5: Docker + K8s — DONE
All files in `deploy/`.

### Docker
- [x] `deploy/docker/frontend.Dockerfile` — multi-stage (node build → nginx)
- [x] `deploy/docker/backend.Dockerfile` — python:3.12-slim, non-root user, healthcheck
- [x] `deploy/docker/nginx.conf` — CSP headers, API proxy, SSE support, gzip, SPA fallback
- [x] `deploy/docker/docker-compose.yml` — frontend + backend + MySQL, health checks, volumes

### Kubernetes (Kustomize)
- [x] `deploy/k8s/base/` — Deployment, Service, Ingress, ConfigMap, Secret, HPA, PVC, Namespace
- [x] `deploy/k8s/overlays/dev/` — 1 replica, localhost CORS
- [x] `deploy/k8s/overlays/staging/` — 2 replicas, staging domain
- [x] `deploy/k8s/overlays/bribrot/` — 2 replicas, bribrot domain
- [x] `deploy/k8s/overlays/production/` — 3 replicas, 50Gi storage, max 12 backend pods

## Phase 6: GitLab CI/CD — DONE
- [x] `.gitlab-ci.yml` — 6 stages: lint, test, security, build, deploy
- [x] **Gate 1 (SAST):** Bandit scan on backend
- [x] **Gate 2 (Deps):** pip-audit + npm audit
- [x] **Gate 3 (Secrets):** detect-secrets scan
- [x] **Gate 4 (Tests):** pytest + vitest
- [x] **Gate 5 (Coverage):** 80% backend, 70% frontend (enforced)
- [x] **Gate 6 (Lint):** ruff + eslint + prettier
- [x] **Gate 7 (Approvals):** GitLab MR setting (manual config needed)
- [x] **Gate 8 (Security Lead):** GitLab MR setting (manual config needed)
- [x] Docker build + push to registry on main/develop
- [x] Deploy staging (auto on develop), production (manual on main)
- [ ] **MANUAL:** Configure branch protection in GitLab UI
- [ ] **MANUAL:** Set up CI runner + registry credentials
- [ ] **MANUAL:** Migrate repo from GitHub to GitLab

## Phase 7: Testing — PARTIALLY DONE
- [x] Backend: pytest + conftest with SQLite test DB + auth fixtures
- [x] Backend: 3 test files (health, records, security)
- [x] Frontend: Vitest + Vue Test Utils in package.json
- [ ] Backend: reach 80% coverage
- [ ] Frontend: write component tests, reach 70% coverage
- [ ] E2E: Playwright test setup

---

## Unresolved Questions
1. ~~Backend language?~~ **Resolved: FastAPI (Python)**
2. Auth system type? OAuth2, SAML, LDAP? — **BLOCKING Phase 4**
3. What is "Bribrot" environment?
4. File storage: local PV or Oracle Object Storage?
5. Oracle Cloud specifics: OKE? Managed MySQL?
6. GitLab: self-hosted or gitlab.com?
7. Data residency: spreadsheet data sent to US AI APIs — restrictions?
8. Jspreadsheet CE GPL license — legal review needed
9. ~~Max xlsx upload size?~~ **Resolved: 50MB default in config**
10. VPN/BAM onboarding timeline?
11. ~~Conversation history persistence~~ **Resolved: in schema**
12. ~~OpenRouter vs Anthropic?~~ **Resolved: backend proxy supports both**
