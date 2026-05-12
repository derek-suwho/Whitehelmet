# Railway Staging Deployment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy frontend + backend to Railway to get a public URL for the auth team to register in Keycloak.

**Architecture:** Two Railway services (frontend nginx + FastAPI backend) in one Railway project, communicating via Railway internal networking (`backend.railway.internal:8000`). Railway MySQL plugin as the temp database. Migrations run at backend startup via Alembic.

**Tech Stack:** Railway, Docker, nginx (envsubst), FastAPI, MySQL 8, Alembic

---

## Bigger Picture

### What Whitehelmet is building

Whitehelmet is a multi-tenant QHSE KPI reporting platform. The immediate client is **PIF (Public Investment Fund, Saudi Arabia)** and its portfolio companies (DevCos). PIF defines KPI templates, DevCos submit data monthly, and Whitehelmet consolidates submissions into a master KPI sheet with auto-applied formulas.

### Why we're integrating with their auth system

Whitehelmet is being integrated into the broader WhiteHelmet platform (a construction/operations SaaS used across Saudi Arabia). Their platform already has:
- A **central Keycloak identity server** that issues JWTs for all products
- A **central Login App** (`signin.whitehelmet.sa`) that handles all user authentication — we do not build our own login page
- A **Laravel Authorization Service** that answers permission questions (S2S calls from our backend)
- A **RabbitMQ event bus** that publishes user/org changes so each service can maintain local shadow tables

Every new service joining the platform must integrate with this auth system. Our app is "AI Reports" in their ecosystem.

### The full production architecture (where we're headed)

```
User (browser)
  │
  ▼
signin.whitehelmet.sa          ← Central Login App (not ours)
  │ redirects back with ?token=<JWT>
  ▼
our-app.whitehelmet.sa          ← Our frontend (Vue 3, on their K8s cluster)
  │ Authorization: Bearer <token>
  ▼
our-api.whitehelmet.sa          ← Our backend (FastAPI, on their K8s cluster)
  ├── MySQL at 10.32.10.184     ← OCI MySQL (their managed instance, Riyadh region)
  ├── Redis (shared, DB=8)      ← Token introspection cache (platform-managed)
  ├── Keycloak introspection    ← Token validity check
  ├── Laravel auth service      ← Permission checks (S2S)
  └── RabbitMQ consumer         ← Syncs org/user shadow tables from Keycloak events
```

**Production infra:** Oracle Cloud (Riyadh region), Kubernetes (Kustomize overlays), GitLab CI/CD, 4 environments: Dev / Staging / Bribrot / Production.

### Why Railway first (and why it's temporary)

To start the Keycloak auth integration, the WhiteHelmet platform team needs a publicly accessible URL for our app so they can:
1. Register it in Keycloak as an allowed redirect URI
2. Configure our feature flag in their CS Dashboard
3. Test the end-to-end login flow

We cannot deploy to their K8s cluster yet — we're still waiting on kubeconfig, container registry credentials, and an assigned subdomain from their infra team. Railway lets us get a public URL today, unblocking the auth setup meeting with Ibrahim Mohamed Abd El-hay.

**This Railway deployment is discarded once we're on their K8s cluster.** The only lasting artifacts are the 3 Docker/nginx file changes (which also improve our local Docker Compose setup).

### Migration path from Railway → their K8s

When their infra team provides cluster access:
1. Update `BACKEND_URL` env var to point to internal K8s service (already parameterized by this plan)
2. Switch `DATABASE_URL` from Railway MySQL → OCI MySQL at `10.32.10.184`
3. Update Keycloak redirect URI from Railway URL → final `*.whitehelmet.sa` subdomain (one config change on their side)
4. Add Redis, RabbitMQ connections and implement the full auth integration (separate phase)
5. Tear down Railway project

### Auth integration scope (after Railway staging is live)

The Railway deployment runs with `AUTH_MODE=local` (existing cookie-session login). After the auth meeting with Ibrahim, we implement:
- **Backend:** 3-step JWT validation (local decode → shadow user lookup → Redis + Keycloak introspection), Alembic migrations for shadow tables, RabbitMQ consumer for org/user sync, Laravel authorization S2S calls
- **Frontend:** Remove login UI, redirect unauthenticated users to central Login App, read `?token` from URL on return, store in localStorage, send as `Authorization: Bearer` header

---

## What Changes and Why

| File | Change | Reason |
|------|--------|--------|
| `deploy/docker/nginx.conf` | `proxy_pass` uses `${BACKEND_URL}` env var | Docker Compose uses `http://backend:8000`; Railway uses `http://backend.railway.internal:8000` |
| `deploy/docker/frontend.Dockerfile` | Add `gettext` (envsubst), change CMD to run envsubst then nginx | Lets us inject `BACKEND_URL` at container start without rebuilding |
| `deploy/docker/backend.Dockerfile` | Add `alembic upgrade head` before uvicorn | Railway env is `staging`, so `create_all` in `main.py` won't run — migrations must be explicit |

Nothing in the frontend Vue code or the FastAPI application code changes.

---

## Chunk 1: Make nginx backend URL configurable

### Task 1: Update nginx.conf to use BACKEND_URL env var

**Files:**
- Modify: `deploy/docker/nginx.conf`

- [ ] **Step 1: Edit nginx.conf — replace hardcoded backend address**

Change line 23 from:
```nginx
        proxy_pass http://backend:8000;
```
To:
```nginx
        proxy_pass ${BACKEND_URL};
```

Final `deploy/docker/nginx.conf`:
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://placehold.co; connect-src 'self' ${BACKEND_URL}; font-src 'self'; object-src 'none'; frame-ancestors 'self';" always;

    location /health {
        access_log off;
        return 200 '{"status":"ok"}';
        add_header Content-Type application/json;
    }

    location /api/ {
        proxy_pass ${BACKEND_URL};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 120s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1000;
}
```

- [ ] **Step 2: Commit**
```bash
git add deploy/docker/nginx.conf
git commit -m "deploy: make nginx backend URL configurable via env var"
```

---

### Task 2: Update frontend Dockerfile to run envsubst at startup

**Files:**
- Modify: `deploy/docker/frontend.Dockerfile`

- [ ] **Step 1: Replace frontend.Dockerfile**

```dockerfile
# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Serve
FROM nginx:1.27-alpine
# gettext provides envsubst
RUN apk add --no-cache gettext
COPY deploy/docker/nginx.conf /etc/nginx/conf.d/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/health || exit 1
# At start: substitute env vars into nginx config, then run nginx
CMD ["/bin/sh", "-c", "envsubst '${BACKEND_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
```

- [ ] **Step 2: Verify docker-compose still works locally**

In `deploy/docker/docker-compose.yml`, add `BACKEND_URL` to frontend service:
```yaml
  frontend:
    build:
      context: ../..
      dockerfile: deploy/docker/frontend.Dockerfile
    ports:
      - "80:80"
    environment:
      BACKEND_URL: "http://backend:8000"
    depends_on:
      backend:
        condition: service_healthy
```

- [ ] **Step 3: Test locally**
```bash
cd deploy/docker
docker compose up --build
# Visit http://localhost — app should load and API calls should work
```

- [ ] **Step 4: Commit**
```bash
git add deploy/docker/frontend.Dockerfile deploy/docker/docker-compose.yml
git commit -m "deploy: inject BACKEND_URL into nginx at container start via envsubst"
```

---

## Chunk 2: Backend — run Alembic migrations on startup

### Task 3: Add migration step to backend Dockerfile

**Files:**
- Modify: `deploy/docker/backend.Dockerfile`

Railway sets `ENVIRONMENT=staging`, which means `main.py`'s `create_all` block won't run. Alembic must run explicitly.

- [ ] **Step 1: Update backend.Dockerfile to run migrations before starting the server**

```dockerfile
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

RUN adduser --disabled-password --gecos "" appuser && \
    mkdir -p /var/data/whitehelmet/uploads && \
    chown -R appuser:appuser /var/data/whitehelmet
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run migrations then start server
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4"]
```

- [ ] **Step 2: Commit**
```bash
git add deploy/docker/backend.Dockerfile
git commit -m "deploy: run alembic migrations before server start"
```

- [ ] **Step 3: Push to GitHub**
```bash
git push origin derek
```

---

## Chunk 3: Railway dashboard setup

These are manual steps in the Railway dashboard (railway.app). No code changes.

### Task 4: Create Railway project and services

- [ ] **Step 1: Create Railway account and project**
  - Go to railway.app → New Project → Empty Project
  - Name it `whitehelmet-staging`

- [ ] **Step 2: Add MySQL plugin**
  - In project → Add Service → Database → MySQL
  - Railway auto-creates `MYSQL_URL` variable on connected services

- [ ] **Step 3: Create backend service**
  - Add Service → GitHub Repo → select your repo
  - Settings → Build:
    - Dockerfile Path: `deploy/docker/backend.Dockerfile`
    - Build Context: `/` (repo root)
  - Name service exactly: `backend`

- [ ] **Step 4: Set backend env vars**

  In backend service → Variables, set:
  ```
  ENVIRONMENT=staging
  DATABASE_URL=${{MySQL.MYSQL_URL}}   ← Railway reference syntax, links to MySQL plugin
  ANTHROPIC_API_KEY=<your key>
  SESSION_SECRET=<random 32 char string>
  CSRF_SECRET=<random 32 char string>
  CORS_ORIGINS=["https://<frontend-url>.up.railway.app"]   ← fill in after frontend deployed
  AUTH_MODE=local
  DEBUG=false
  ```

  > `DATABASE_URL` format: Railway MySQL plugin provides `mysql://user:pass@host:port/db` — FastAPI expects `mysql+pymysql://...`. You may need to add `+pymysql` manually: `mysql+pymysql://user:pass@host:port/db`

- [ ] **Step 5: Deploy backend and get its URL**
  - Deploy → wait for health check to pass
  - Settings → Networking → Generate Domain → copy URL (e.g. `https://backend-production-xxxx.up.railway.app`)

- [ ] **Step 6: Create frontend service**
  - Add Service → GitHub Repo → same repo
  - Settings → Build:
    - Dockerfile Path: `deploy/docker/frontend.Dockerfile`
    - Build Context: `/` (repo root)
  - Name service: `frontend`

- [ ] **Step 7: Set frontend env vars**
  ```
  BACKEND_URL=http://backend.railway.internal:8000
  ```
  > Uses Railway private networking — `backend` is the exact service name from Step 3.

- [ ] **Step 8: Deploy frontend and get its URL**
  - Deploy → wait for health check
  - Generate Domain → copy URL (e.g. `https://frontend-production-xxxx.up.railway.app`)

- [ ] **Step 9: Update backend CORS with frontend URL**
  - Go back to backend service → Variables
  - Update `CORS_ORIGINS` to the actual frontend URL from Step 8:
    ```
    CORS_ORIGINS=["https://frontend-production-xxxx.up.railway.app"]
    ```
  - Redeploy backend

- [ ] **Step 10: Smoke test**
  - Visit the frontend Railway URL in browser
  - App should load, login should work, spreadsheet editor should open

---

## Chunk 4: Share URL with auth team

- [ ] **Step 1: Share frontend URL with Adel/Ibrahim**

  Message: "STG env is live at `https://<frontend-url>.up.railway.app`. Ready to schedule the setup meeting with Ibrahim."

- [ ] **Step 2: Note what they'll need from you for Keycloak registration**
  - Our app's landing page URL (the frontend Railway URL)
  - The redirect URI to register (same URL + `/*`)

---

## Open Questions

- DATABASE_URL format: confirm Railway MySQL URL uses `mysql://` prefix — if so, must manually add `+pymysql` when setting the env var
- Do we need to set `UPLOAD_DIR` on Railway? (file uploads won't persist across redeploys without a volume — acceptable for temp staging)
- Does `AUTH_MODE=local` mean the current cookie-session login still works for temp staging? Yes — we keep local auth until the Keycloak integration is implemented.
