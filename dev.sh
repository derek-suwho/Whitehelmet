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
