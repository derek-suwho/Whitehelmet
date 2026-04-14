#!/bin/bash
# Whitehelmet dev: FastAPI backend (:8000) + serve.mjs proxy/static (:3000)
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
  echo "→ Created backend/.env from template. Set OPENROUTER_API_KEY before using AI features."
  cp backend/.env.example backend/.env
fi

# Clean up background processes on exit
trap 'kill $(jobs -p) 2>/dev/null' EXIT INT TERM

echo "→ Starting FastAPI on http://localhost:8000"
(cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000) &

# Give uvicorn a moment to bind before serve.mjs starts forwarding
sleep 1

echo "→ Starting frontend proxy on http://localhost:3000"
node serve.mjs
