#!/usr/bin/env bash
# Create a clean ZIP of the Thunity repo for sending to the demo machine.
# Excludes build artifacts, caches, node_modules, archives, and secrets.
# Usage:
#   bash scripts/create_clean_zip.sh                 # -> thunity-clean.zip
#   bash scripts/create_clean_zip.sh my-output.zip
# Does NOT delete repo files (only overwrites its own output archive).
set -u

OUT="${1:-thunity-clean.zip}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || { echo "Cannot cd to repo root"; exit 1; }

if [[ ! -f "docker-compose.yml" || ! -f "frontend/package.json" ]]; then
  echo "Refusing to run: not in repo root (need docker-compose.yml and frontend/package.json)."
  exit 1
fi
command -v zip >/dev/null 2>&1 || { echo "zip is not installed. Install zip and retry."; exit 1; }

rm -f "$OUT"
echo "Packaging $OUT (excluding build artifacts, caches, node_modules, archives, secrets)…"
zip -r "$OUT" . \
  -x "*/.git/*" \
  -x "*/node_modules/*" \
  -x "frontend/dist/*" -x "frontend/dist" \
  -x "frontend/dist_*/*" -x "frontend/dist_*" \
  -x "frontend/vite.config.ts.timestamp-*.mjs" \
  -x "*/__pycache__/*" -x "*.pyc" \
  -x "*/.pytest_cache/*" -x "pytest-cache-files-*/*" \
  -x "*/.mypy_cache/*" -x "*/.ruff_cache/*" -x "*/coverage/*" -x "*.coverage" \
  -x "*/.DS_Store" -x "__MACOSX/*" \
  -x "*.zip" -x "*.tar" -x "*.gz" \
  -x ".env" -x "*/.env" \
  -x ".DS_Store" -x "./.DS_Store" \
  -x ".pytest_cache" -x ".pytest_cache/*" -x "./.pytest_cache/*" \
  -x "pytest-cache-files-*" -x "pytest-cache-files-*/*" -x "./pytest-cache-files-*" -x "./pytest-cache-files-*/*" \
  -x "__MACOSX" -x "__MACOSX/*" -x "./__MACOSX/*" \
  -x ".coverage" -x "./.coverage" >/dev/null

echo "Done. (.env.example IS included; real .env is NOT.)"
ls -lh "$OUT"
