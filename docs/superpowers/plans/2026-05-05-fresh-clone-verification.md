# Fresh-Clone Verification Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `./dev.sh` and `docker compose up --build` both work from a clean clone with no manual steps beyond filling in `.env`.

**Architecture:** Two setup paths — `dev.sh` (local Python + Vite dev server) and docker-compose (full containerized stack). Fix `dev.sh` to handle npm install, PYTHONPATH, and alembic migrations. Verify docker-compose path works end-to-end. Update README to be the single source of truth.

**Tech Stack:** Bash, FastAPI/Alembic, Vue 3/Vite, MySQL 8, Docker Compose

---

## Chunk 1: Fix dev.sh

### Task 1: Fix dev.sh — npm install + frontend server

**Files:**
- Modify: `dev.sh`

**Problem:** `dev.sh` calls `node serve.mjs` which doesn't exist. Vue 3 frontend should run via `npm run dev` (Vite on :5173 with /api proxy to :8000).

- [ ] **Step 1: Update dev.sh**

Replace the file with:

```bash
#!/bin/bash
# Whitehelmet dev: FastAPI backend (:8000) + Vite frontend (:5173)
# Usage: ./dev.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Bootstrap backend venv
if [ ! -d backend/.venv ]; then
  echo "→ Creating backend/.venv and installing requirements..."
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install --quiet -r backend/requirements.txt
fi

# Bootstrap backend .env
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo "→ Created backend/.env from template. Fill in DATABASE_URL and API keys before continuing."
  exit 1
fi

# Bootstrap frontend deps
if [ ! -d frontend/node_modules ]; then
  echo "→ Installing frontend npm dependencies..."
  (cd frontend && npm install --silent)
fi

# Run DB migrations
echo "→ Running alembic migrations..."
(cd backend && PYTHONPATH=. .venv/bin/alembic upgrade head)

# Clean up background processes on exit
trap 'kill $(jobs -p) 2>/dev/null' EXIT INT TERM

echo "→ Starting FastAPI on http://localhost:8000"
(cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000) &

sleep 1

echo "→ Starting Vite frontend on http://localhost:5173"
(cd frontend && npm run dev)
```

- [ ] **Step 2: Verify dev.sh is executable**

```bash
chmod +x dev.sh
```

- [ ] **Step 3: Dry-run test (no MySQL yet — expect migration to fail gracefully with clear error)**

```bash
# Simulate fresh clone: remove venv and node_modules
rm -rf backend/.venv frontend/node_modules backend/.env

# Run dev.sh — should install venv, npm deps, then exit with env prompt
./dev.sh
# Expected: prints "Created backend/.env from template. Fill in DATABASE_URL..." and exits
```

- [ ] **Step 4: Commit**

```bash
git add dev.sh
git commit -m "fix: dev.sh — npm install, alembic migrations, Vite frontend"
```

---

## Chunk 2: Verify docker-compose path

### Task 2: Smoke test via docker-compose

**Files:**
- Read: `deploy/docker/docker-compose.yml`
- Read: `backend/.env.example`

Docker-compose handles MySQL automatically. This is the canonical fresh-clone path.

- [ ] **Step 1: Confirm backend/.env exists with correct DATABASE_URL for docker-compose**

For docker-compose, `DATABASE_URL` must point to the `db` service (not localhost):
```
DATABASE_URL=mysql+pymysql://whitehelmet:changeme@db:3306/whitehelmet
```
Verify `.env.example` has this as default (it does — already correct).

- [ ] **Step 2: Build and start docker-compose**

```bash
cd deploy/docker
docker compose up --build
```

Expected: MySQL starts → backend waits for healthcheck → backend starts → runs alembic → frontend nginx serves on :80

- [ ] **Step 3: Verify health endpoint**

```bash
curl http://localhost:8000/health
# Expected: {"status": "ok"} or similar
```

- [ ] **Step 4: Verify frontend loads**

Open http://localhost:80 in browser — should show login page.

- [ ] **Step 5: Check alembic ran in backend container logs**

```bash
docker compose logs backend | grep alembic
# Expected: lines showing migration steps completing
```

- [ ] **Step 6: Note any failures and fix**

If backend fails to start, check:
- `docker compose logs backend` for error
- Common issues: missing env vars, migration failure, import errors

- [ ] **Step 7: Tear down**

```bash
docker compose down -v
```

---

## Chunk 3: Update README

### Task 3: Rewrite README setup section

**Files:**
- Modify: `README.md`

README currently documents a manual setup that doesn't match `dev.sh`. Needs to reflect both paths clearly.

- [ ] **Step 1: Update the Prerequisites and Local dev sections**

Replace the "Local dev — production stack" and "Local dev — docker-compose" sections with:

```markdown
## Quick Start

### Option A — docker-compose (recommended for fresh setup)

Brings up frontend, backend, and MySQL together. No local Python or Node required.

```bash
cp backend/.env.example backend/.env
# Fill in ANTHROPIC_API_KEY or OPENROUTER_API_KEY (all other defaults work for local)

cd deploy/docker
docker compose up --build
```

Frontend on http://localhost, backend on http://localhost:8000.
Migrations run automatically on startup.

### Option B — local dev (hot reload)

Requires Python 3.11+, Node 18+, and a MySQL 8 instance.

```bash
cp backend/.env.example backend/.env
# Fill in DATABASE_URL (point to your MySQL instance) and API keys

./dev.sh
```

- Backend: http://localhost:8000 (uvicorn --reload)
- Frontend: http://localhost:5173 (Vite, hot reload)

`dev.sh` auto-creates the Python venv, installs npm deps, and runs `alembic upgrade head` on first run.

### Required env vars

| Var | Description |
|-----|-------------|
| `DATABASE_URL` | MySQL connection string |
| `ANTHROPIC_API_KEY` | Anthropic API key (or use OpenRouter) |
| `OPENROUTER_API_KEY` | OpenRouter API key (optional) |
| `SESSION_SECRET` | Random 64-char string |
| `CSRF_SECRET` | Random 64-char string (different from SESSION_SECRET) |
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README setup — match dev.sh and docker-compose paths"
```

---

## Chunk 4: Full Smoke Test + MERGE_STATUS Update

### Task 4: Smoke test local dev path

**Prerequisite:** MySQL running. If not available locally, use the docker-compose MySQL service with port 3306 exposed.

- [ ] **Step 1: Start MySQL via docker (if no local MySQL)**

```bash
cd deploy/docker
docker compose up db -d
# Wait for healthcheck to pass (~10s)
```

- [ ] **Step 2: Set DATABASE_URL in backend/.env to local MySQL**

```
DATABASE_URL=mysql+pymysql://whitehelmet:changeme@localhost:3306/whitehelmet
```

- [ ] **Step 3: Create the DB if it doesn't exist**

```bash
docker compose exec db mysql -u root -prootpass -e "CREATE DATABASE IF NOT EXISTS whitehelmet;"
```

- [ ] **Step 4: Run dev.sh**

```bash
./dev.sh
# Expected: venv install (if needed) → alembic upgrade head succeeds → uvicorn starts → Vite starts
```

- [ ] **Step 5: Verify backend health**

```bash
curl http://localhost:8000/health
```

- [ ] **Step 6: Verify frontend loads at http://localhost:5173**

Open in browser → login page renders without console errors.

- [ ] **Step 7: Mark Phase 4 complete in MERGE_STATUS.md**

Check off all items under "Phase 4 — Fresh-clone verification".

- [ ] **Step 8: Final commit**

```bash
git add MERGE_STATUS.md
git commit -m "chore: fresh-clone verification complete"
```

---

## Unresolved Questions

- Does the backend run `alembic upgrade head` automatically on startup, or only via `dev.sh`? (If not automatic in docker, the Dockerfile needs an entrypoint script.)
- Is there a `backend/Dockerfile` entrypoint that runs migrations before starting uvicorn?
