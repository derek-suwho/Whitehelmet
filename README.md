# Whitehelmet

Web app for construction companies that consolidates subcontractor Excel reports into a master record. Three-panel workspace: file sources (left), spreadsheet editor (center), AI chat (right). Users upload `.xlsx` files, select them, hit Consolidate, and Claude merges them. Users can also type natural-language commands ("add a Total column", "sort by date") to mutate the live spreadsheet.

## Stack

Production stack (split repo layout):

- **Backend** — FastAPI (Python 3.11), SQLAlchemy 2, MySQL 8, Redis, Alembic, httpx-based AI proxy
- **Frontend** — Vue 3 + TypeScript, Vite, Pinia, Vue Router, Tailwind CSS, Jspreadsheet CE, SheetJS
- **Deploy** — Docker + docker-compose for local, Kubernetes (Kustomize overlays) for dev/staging/prod/bribrot
- **Auth** — session-cookie based, CSRF-protected, backed by Whitehelmet external auth service (stubbed)
- **Tests** — pytest + coverage (backend), Vitest + Playwright (frontend)

## Layout

```
backend/              FastAPI service
  app/
    main.py           app entry, CORS, router wiring
    core/             config, security, dependencies, rate_limit
    api/routes/       health, auth, ai, records, files
    models/           User, Record, UploadedFile, ConversationMessage, SessionModel
    schemas/          Pydantic request/response models
    db/session.py     SQLAlchemy engine + session
  migrations/         Alembic
  tests/              unit + integration (pytest, 80% coverage floor)
  requirements.txt
  pyproject.toml

frontend/             Vue 3 SPA
  src/
    main.ts           app bootstrap (Pinia + Router)
    App.vue
    router/           route guards, auth redirect
    views/            LoginView, WorkspaceView, DashboardView
    components/
      layout/TopBar.vue
      sources/SourcesPanel.vue
      editor/SpreadsheetEditor.vue
      chat/ChatPanel.vue
    stores/           auth, chat, records, sources, spreadsheet (Pinia)
    composables/      useApi, useAiOperations, useConsolidation
  vite.config.ts
  vitest.config.ts
  playwright.config.ts
  tailwind.config.js

deploy/
  docker/             backend.Dockerfile, frontend.Dockerfile, nginx.conf, docker-compose.yml
  k8s/
    base/             namespace, deployments, ingress, hpa, pvc, configmap, secret
    overlays/         dev, staging, production, bribrot

```

## Backend API

All `/api/*` routes except `/api/auth/login` and `/health` require a valid session cookie plus `X-CSRF-Token` header.

| Route | Purpose |
|-------|---------|
| `GET /health` | Liveness probe |
| `POST /api/auth/login` | Session cookie + CSRF token (rate-limited) |
| `POST /api/auth/logout` | Destroy session |
| `GET /api/auth/me` | Current user |
| `POST /api/ai/chat` | SSE-streamed chat proxy (OpenRouter) |
| `POST /api/ai/consolidate` | Multi-file AI merge |
| `POST /api/ai/command` | Natural-language spreadsheet command → structured op |
| `GET/POST/DELETE /api/records` | User-scoped master records |
| `POST /api/files` | Upload `.xlsx` (50 MB cap) |

AI keys (`ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`) live server-side only — never exposed to the frontend.

## Quick Start

### Option A — docker-compose (recommended for fresh setup)

No local Python or Node required. Brings up frontend, backend, and MySQL. Migrations run automatically.

```bash
cp backend/.env.example backend/.env
# Edit backend/.env — fill in ANTHROPIC_API_KEY or OPENROUTER_API_KEY
# All other defaults work for local docker-compose

cd deploy/docker
docker compose up --build
```

- Frontend: http://localhost
- Backend: http://localhost:8000

### Option B — local dev (hot reload)

Requires Python 3.11+, Node 18+, and a MySQL 8 instance.

```bash
cp backend/.env.example backend/.env
# Edit backend/.env — set DATABASE_URL to your MySQL instance, fill in API keys

./dev.sh
```

- Backend: http://localhost:8000 (uvicorn --reload)
- Frontend: http://localhost:5173 (Vite, hot reload)

`dev.sh` auto-creates the Python venv, installs npm deps, and runs `alembic upgrade head` on first run.

### Required env vars

| Var | Description |
|-----|-------------|
| `DATABASE_URL` | MySQL connection string (e.g. `mysql+pymysql://user:pass@localhost:3306/whitehelmet`) |
| `ANTHROPIC_API_KEY` | Anthropic API key (or use OpenRouter) |
| `OPENROUTER_API_KEY` | OpenRouter API key (optional alternative to Anthropic) |
| `SESSION_SECRET` | Random 64-char string |
| `CSRF_SECRET` | Different random 64-char string |

All vars documented in `backend/.env.example`.

## Kubernetes

Kustomize overlays in `deploy/k8s/overlays/{dev,staging,production,bribrot}`:

```bash
kubectl apply -k deploy/k8s/overlays/dev
```

## Tests

```bash
# Backend — pytest, ruff, bandit, 80% coverage floor
cd backend
pytest
ruff check .
bandit -r app

# Frontend — vitest unit + playwright e2e
cd frontend
npm run test
npm run test:coverage
npm run test:e2e
npm run type-check
npm run lint
```

