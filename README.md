# Whitehelmet

Web app for construction companies that consolidates subcontractor Excel reports into a master record. Three-panel workspace: file sources (left), spreadsheet editor (center), AI chat (right). Users upload `.xlsx` files, select them, hit Consolidate, and Claude merges them. Users can also type natural-language commands ("add a Total column", "sort by date") to mutate the live spreadsheet.

## Stack

Production stack (split repo layout):

- **Backend** — FastAPI (Python 3.11), SQLAlchemy 2, MySQL 8, Redis, Alembic, httpx-based AI proxy
- **Frontend** — Vue 3 + TypeScript, Vite, Pinia, Vue Router, Tailwind CSS, Jspreadsheet CE, SheetJS
- **Deploy** — Docker + docker-compose for local, Kubernetes (Kustomize overlays) for dev/staging/prod/bribrot
- **Auth** — session-cookie based, CSRF-protected, backed by Whitehelmet external auth service (stubbed)
- **Tests** — pytest + coverage (backend), Vitest + Playwright (frontend)

A legacy single-file MVP (`index.html`, `js/`, `css/`, `serve.mjs`) still lives in the repo root for reference and quick prototyping.

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

index.html, js/, css/, serve.mjs   legacy single-file MVP (not the production app)
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

## Prerequisites

- Python 3.11+
- Node.js 18+
- MySQL 8 (or Docker)
- Redis (for rate limiting)
- OpenRouter or Anthropic API key

## Local dev — production stack

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in DB creds, API keys, session/csrf secrets
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend (separate shell)
cd frontend
npm install
npm run dev            # http://localhost:5173
```

Backend reads config from `backend/.env`. Required vars:

```
ENVIRONMENT=dev
DEBUG=true
DB_HOST=localhost
DB_PORT=3306
DB_NAME=whitehelmet
DB_USER=whitehelmet
DB_PASSWORD=...
ANTHROPIC_API_KEY=...
OPENROUTER_API_KEY=...
SESSION_SECRET=...
CSRF_SECRET=...
CORS_ORIGINS=["http://localhost:5173"]
```

## Local dev — docker-compose

Brings up frontend (nginx), backend, and MySQL together:

```bash
cd deploy/docker
docker compose up --build
```

Frontend on `:80`, backend on `:8000`, MySQL on `:3306`.

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

## Legacy MVP

The original single-file vanilla-JS app still builds and runs from the repo root:

```bash
node serve.mjs   # http://localhost:3000
```

Entry is `index.html`, modules in `js/`, styles in `css/`. Kept around for reference; new work should land in `backend/` and `frontend/`.

## Screenshots

```bash
node screenshot.mjs http://localhost:5173
```

Saves to `temporary screenshots/screenshot-N.png`. Puppeteer Chrome path is hardcoded for macOS ARM in `screenshot.mjs` — adjust `executablePath` for other platforms.
