#!/usr/bin/env bash
# ── Thunity — frontend dependency reset (npm clean reinstall) ──────────
# Fixes "stale node_modules" npm errors. Deletes ONLY:
#   frontend/node_modules  and  frontend/package-lock.json
# Never touches source files, backend, Docker volumes, Ollama models, or .env.
# Requires confirmation unless --yes is passed.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || { echo "Cannot cd to repo root"; exit 1; }
FE="$ROOT/frontend"

[ -d "$FE" ] || { echo "frontend/ not found at $FE"; exit 1; }
[ -f "$FE/package.json" ] || { echo "frontend/package.json not found — refusing to run"; exit 1; }

YES=0
[ "${1:-}" = "--yes" ] && YES=1

echo "This will delete and reinstall frontend dependencies:"
echo "  - $FE/node_modules"
echo "  - $FE/package-lock.json"
echo "Source files are NOT touched. Backend/Docker/Ollama/.env are NOT touched."
echo

if [ "$YES" -ne 1 ]; then
  printf "Proceed? [y/N] "
  read -r ans
  case "$ans" in y|Y|yes|YES) ;; *) echo "Aborted."; exit 0;; esac
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found on PATH. Install Node 18+ first (macOS: brew install node)."
  exit 1
fi

echo "Removing node_modules…"
rm -rf "$FE/node_modules"
echo "Removing package-lock.json…"
rm -f "$FE/package-lock.json"

echo "Running npm install in frontend…"
cd "$FE" || exit 1
if npm install; then
  echo
  echo "Done. Dependencies reinstalled. Start the dev server with:"
  echo "  (cd frontend && npm run dev)    # http://localhost:3000"
else
  echo
  echo "npm install failed. Check the error above (network, Node version, disk space)."
  exit 1
fi
