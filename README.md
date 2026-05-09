# Whitehelmet

Multi-tenant QHSE KPI reporting and consolidation platform. PIF (Public Investment Fund) defines standardized KPI templates, portfolio companies (DevCos) submit data, and Whitehelmet auto-applies PIF-owned calculation formulas and consolidates all submissions into a master KPI sheet.

Three-panel workspace: sources (left), spreadsheet editor (center), AI chat (right). Natural-language commands ("add a Total column", "sort by date") mutate the live spreadsheet via Claude.

## Stack

- **Backend** — FastAPI (Python 3.11), SQLAlchemy 2, Alembic, Supabase (PostgreSQL), httpx AI proxy
- **Frontend** — Vue 3 + TypeScript, Vite, Pinia, Vue Router, Tailwind CSS, Jspreadsheet CE, SheetJS
- **Auth** — Keycloak OAuth2/OIDC; JWT validated server-side; roles mapped from token claims
- **Edge Functions** — Supabase Deno functions for AI-assisted template operations and consolidation
- **Deploy** — Docker + docker-compose (local), Kubernetes with Kustomize overlays (dev/staging/prod/bribrot), Oracle Cloud Riyadh region
- **Tests** — pytest + coverage (backend), Vitest + Playwright (frontend)

## Roles

| Role | Description |
|---|---|
| `org_super_admin` | PIF — full access, manages templates, formulas, organizations |
| `org_admin` | DevCo admin — manages org members, views assignments |
| `org_member` | DevCo user — fills and submits assigned templates |
| `subcontractor` | External — limited portal access |

## Layout

```
backend/              FastAPI service
  app/
    main.py           app entry, CORS, router wiring
    core/             config, security, dependencies, rbac, rate_limit
    api/routes/       health, auth, ai, records, files, templates,
                      assignments, formulas, organizations, projects,
                      admin, subcontractor
    models/           Profile, Record, UploadedFile, Template,
                      TemplateVersion, TemplateAssignment, Submission,
                      Formula, ConsolidatedSheet, Project
    schemas/          Pydantic request/response models
    db/session.py     SQLAlchemy engine + session
  migrations/         Alembic (backend-owned tables)
  tests/              unit + integration (pytest, 74% coverage floor)
  pyproject.toml

frontend/             Vue 3 SPA
  src/
    main.ts           app bootstrap (Pinia + Router)
    App.vue
    router/           route guards, auth redirect
    views/            LoginView, WorkspaceView, DashboardView, TrackerView
    components/
      layout/TopBar.vue
      sources/SourcesPanel.vue
      editor/SpreadsheetEditor.vue
      chat/ChatPanel.vue
    stores/           auth, chat, records, sources, spreadsheet (Pinia)
    composables/      useApi, useAiOperations, useConsolidation
  vite.config.ts

supabase/
  migrations/         PostgreSQL schema migrations (run in timestamp order)
  functions/          Deno edge functions
    g2-consolidate          AI-powered multi-submission consolidation
    g2-finetune-consolidated  Post-consolidation AI refinement
    g2-generate-template-ai  AI-assisted template schema generation
    g2-parse-template       Parse uploaded xlsx into template schema

deploy/
  docker/             backend.Dockerfile, frontend.Dockerfile,
                      nginx.conf, docker-compose.yml
  k8s/
    base/             namespace, deployments, ingress, hpa, pvc,
                      configmap, secret
    overlays/         dev, staging, production, bribrot
```

## Backend API

All `/api/*` routes require a valid Keycloak JWT (`Authorization: Bearer <token>`). Role requirements are noted below.

| Route | Role | Purpose |
|---|---|---|
| `GET /health` | — | Liveness probe |
| `GET /api/auth/me` | any | Current user profile |
| `GET/POST /api/templates` | org_super_admin | Template CRUD |
| `GET /api/templates/{id}/versions` | org_admin+ | Template versions |
| `POST /api/templates/{id}/versions` | org_super_admin | Publish new version |
| `GET /api/templates/{id}/consolidations` | org_super_admin | Consolidated sheets |
| `POST /api/assignments` | org_super_admin | Assign template to org |
| `GET/POST/DELETE /api/formulas` | org_super_admin | Formula library |
| `GET/POST/DELETE /api/records` | any | User-scoped master records |
| `POST /api/files` | any | Upload `.xlsx` (50 MB cap) |
| `POST /api/ai/chat` | any | SSE-streamed AI chat |
| `POST /api/ai/consolidate` | any | Multi-file AI merge |
| `POST /api/ai/command` | any | NL spreadsheet command → op |
| `GET /api/organizations` | org_super_admin | Organization list |
| `GET /api/projects` | org_admin+ | Project list |
| `GET /api/admin/*` | org_super_admin | Admin coverage endpoints |
| `GET /api/subcontractor/*` | subcontractor | Subcontractor portal |

AI keys (`ANTHROPIC_API_KEY`) live server-side only — never exposed to the frontend.

## Quick Start

### Prerequisites

- Python 3.11+
- Node 18+
- Git
- Docker (only for docker-compose option)

### 1. Clone and configure

```bash
git clone <repo-url> && cd whitehelmet
cp backend/.env.example backend/.env
```

Get the filled `.env` file from a team member — it contains Supabase credentials and API keys that are not committed to the repo.

### Required env vars

| Var | Description |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `SUPABASE_URL` | Supabase project URL (used for JWKS) |
| `ANTHROPIC_API_KEY` | Anthropic API key (server-side only) |

Optional: `OPENROUTER_API_KEY`, `CORS_ORIGINS`, `MAX_UPLOAD_SIZE_MB`, `UPLOAD_DIR`. See `backend/.env.example` for all options.

### 2a. Local dev (hot reload)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head          # apply database migrations
uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

- Backend: http://localhost:8000
- Frontend: http://localhost:5173

### 2b. Docker-compose

```bash
cd deploy/docker
docker compose up --build
```

- Frontend: http://localhost
- Backend: http://localhost:8000

### Database migrations

Supabase schema migrations live in `supabase/migrations/` and are applied to the shared Supabase instance. Backend-owned tables use Alembic (`backend/migrations/`).

```bash
# Alembic (run after pulling new changes)
cd backend && alembic upgrade head

# Supabase (only if running a local Supabase instance)
supabase db push
```

> **Note:** If you're connecting to the shared Supabase project (most devs), schema migrations are already applied — you only need to run `alembic upgrade head`.

## Kubernetes

Kustomize overlays in `deploy/k8s/overlays/{dev,staging,production,bribrot}`:

```bash
kubectl apply -k deploy/k8s/overlays/dev
```

## Tests

```bash
# Backend — pytest, ruff, bandit
cd backend
pytest
ruff check .
bandit -r app

# Frontend — vitest unit + playwright e2e
cd frontend
npm run test
npm run test:coverage
npm run test:e2e
npm run lint
```
