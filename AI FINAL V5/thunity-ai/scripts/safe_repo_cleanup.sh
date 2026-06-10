#!/usr/bin/env bash
# Safe, local repo cleanup for Thunity Local AI Company OS.
#
# DRY-RUN by default — prints what WOULD be removed and deletes nothing.
#   bash scripts/safe_repo_cleanup.sh            # dry run
#   bash scripts/safe_repo_cleanup.sh --apply    # actually delete safe junk
#
# NEVER touches: .env, .env.example, docker-compose.yml, node_modules, source files,
# docs, package.json / lockfiles / requirements / migrations, uploaded data, or any
# Docker / Ollama / Postgres / Redis / n8n volume or model file. Removes only
# regenerable junk (build output, caches, .DS_Store, Vite temp files, root ZIPs).
set -u

APPLY=0
case "${1:-}" in
  "")        APPLY=0 ;;
  "--apply") APPLY=1 ;;
  *) echo "Usage: $0 [--apply]"; exit 2 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || { echo "Cannot cd to repo root"; exit 1; }

if [[ ! -f "docker-compose.yml" || ! -f "frontend/package.json" ]]; then
  echo "Refusing to run: not in repo root (need docker-compose.yml and frontend/package.json)."
  exit 1
fi

mode="DRY-RUN"; [[ $APPLY -eq 1 ]] && mode="APPLY"
echo "== Thunity safe cleanup ($mode) =="
echo "root: $ROOT"

note() { if [[ $APPLY -eq 1 ]]; then echo "[delete]  $1"; else echo "[dry-run] would remove: $1"; fi; }
zap()  { note "$1"; [[ $APPLY -eq 1 ]] && rm -rf "$1" 2>/dev/null || true; }

# junk directories (skip node_modules and .git)
find . \( -path ./frontend/node_modules -o -path ./.git \) -prune -o \
  -type d \( -name __pycache__ -o -name .pytest_cache -o -name .mypy_cache \
             -o -name .ruff_cache -o -name coverage -o -name __MACOSX \
             -o -name 'pytest-cache-files-*' \) -print0 2>/dev/null |
while IFS= read -r -d '' d; do zap "$d"; done

# frontend build output: dist and ALL dist_* variants
for d in frontend/dist frontend/dist_*; do
  [ -e "$d" ] || continue
  zap "$d"
done

# junk files (skip node_modules and .git)
find . \( -path ./frontend/node_modules -o -path ./.git \) -prune -o \
  -type f \( -name .DS_Store -o -name '*.pyc' -o -name .coverage \
             -o -name 'vite.config.ts.timestamp-*.mjs' \) -print0 2>/dev/null |
while IFS= read -r -d '' f; do zap "$f"; done

# root-level generated ZIPs ONLY (never recursive)
echo "-- root-level generated ZIP candidates --"
shopt -s nullglob
found_zip=0
for z in *delta*.zip *handoff*.zip *cleanup*.zip *post-demo*.zip; do
  found_zip=1; zap "$z"
done
[[ $found_zip -eq 0 ]] && echo "  (none)"
shopt -u nullglob

echo "== done =="
[[ $APPLY -eq 0 ]] && echo "Dry run only — nothing deleted. Re-run with --apply to delete."
exit 0
