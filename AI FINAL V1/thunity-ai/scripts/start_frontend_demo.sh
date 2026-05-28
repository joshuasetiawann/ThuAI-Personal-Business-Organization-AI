#!/usr/bin/env bash
# Non-destructive frontend demo launcher for Thunity.
# Builds and serves the Vite frontend. The backend must already be running
# separately. Does NOT touch Docker/Ollama/Postgres/Redis/n8n or run npm install.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || { echo "Cannot cd to repo root"; exit 1; }

if [[ ! -f "docker-compose.yml" || ! -f "frontend/package.json" ]]; then
  echo "Refusing to run: not in repo root (need docker-compose.yml and frontend/package.json)."
  exit 1
fi

cd frontend || { echo "Cannot cd to frontend"; exit 1; }

if [[ ! -d node_modules ]]; then
  echo "frontend/node_modules is missing. Run npm install in frontend first."
  exit 1
fi

echo "Backend must already be running separately (e.g. http://127.0.0.1:8000)."
echo "Open the Vite URL shown below in the browser."
rm -rf dist
npm run build
npm run dev -- --host 0.0.0.0
