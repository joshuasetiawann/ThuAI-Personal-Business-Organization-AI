#!/usr/bin/env bash
# ── Thunity — one-command start for Acung's MacBook ────────────────────
# Starts Docker services (postgres, redis, n8n, backend) WITHOUT container
# Ollama (Mac uses HOST Ollama on :11434), then the Vite frontend on :3000.
#
# SAFE: never runs 'docker compose down -v', never deletes volumes/models,
# never pulls models. Honest: prints PASS/FAIL health, doesn't fake success.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || { echo "Cannot cd to repo root"; exit 1; }

GREEN=$'\033[32m'; RED=$'\033[31m'; YEL=$'\033[33m'; BOLD=$'\033[1m'; DIM=$'\033[2m'; RST=$'\033[0m'
say(){ echo "${BOLD}» $*${RST}"; }
ok(){ echo "${GREEN}OK${RST}   $*"; }
bad(){ echo "${RED}STOP${RST} $*"; }
warn(){ echo "${YEL}WARN${RST} $*"; }

[ -f docker-compose.yml ] && [ -f frontend/package.json ] || { bad "Not in repo root (need docker-compose.yml + frontend/package.json)"; exit 1; }

echo "${BOLD}── Thunity • Mac start ───────────────────────────────────${RST}"
echo "repo: $ROOT"; echo

# 1) Docker
if ! command -v docker >/dev/null 2>&1; then bad "Docker not installed. Install Docker Desktop, then re-run."; exit 1; fi
if ! docker info >/dev/null 2>&1; then bad "Docker is not running. Open Docker Desktop, wait for 'running', then re-run."; exit 1; fi
DC="docker compose"; docker compose version >/dev/null 2>&1 || DC="docker-compose"
ok "Docker ready ($DC)"

# 2) .env
if [ ! -f .env ]; then
  cp .env.example .env
  warn ".env was missing — created it from .env.example."
  echo "${YEL}Please open .env and set at least POSTGRES_PASSWORD, N8N_BASIC_AUTH_PASSWORD, SECRET_KEY, FOUNDER_PASSWORD.${RST}"
  echo "Then re-run this script. (Stopping now so you can review secrets.)"
  exit 0
fi
miss=""
for v in POSTGRES_PASSWORD N8N_BASIC_AUTH_PASSWORD; do grep -qE "^[[:space:]]*$v=" .env || miss="$miss $v"; done
if [ -n "$miss" ]; then bad ".env is missing required var(s):$miss — compose will not start. Add them from .env.example."; exit 1; fi
ok ".env present with required vars"

# 3) Host Ollama (Mac uses host Ollama, not a container)
export OLLAMA_URL="http://host.docker.internal:11434"   # backend container -> host Ollama
if command -v curl >/dev/null 2>&1 && curl -s --max-time 3 http://localhost:11434/api/tags >/dev/null 2>&1; then
  ok "Host Ollama reachable on :11434"
else
  warn "Host Ollama not reachable on :11434. The app starts, but AI replies need it."
  echo "${DIM}      Install/start it separately:  brew install ollama && ollama serve${RST}"
  echo "${DIM}      (This script never pulls models. Pull them yourself when ready.)${RST}"
fi

# 4) Start backend stack (NO container ollama — profile 'ollama' is left off)
say "Starting Docker services: postgres, redis, n8n, backend …"
if ! $DC up -d postgres redis n8n backend; then
  bad "docker compose failed to start services. Run: scripts/dev_doctor.sh"
  exit 1
fi
ok "Docker services requested. Giving backend a few seconds to boot…"
sleep 6

# 5) Frontend deps
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  bad "Node.js/npm not found. Backend may be up, but the UI cannot start."
  echo "${DIM}      Install Node 18+ (brew install node), then re-run this script.${RST}"
  echo "${DIM}      Backend services are still running. Check: scripts/check_thunity_health.sh${RST}"
  exit 1
fi
if [ ! -d frontend/node_modules ]; then
  say "Installing frontend dependencies (first run)…"
  if ! ( cd frontend && npm install ); then
    bad "npm install failed. Try a clean reset: scripts/reset_frontend_deps.sh"
    exit 1
  fi
fi

# 6) Health snapshot (honest PASS/FAIL) before handing terminal to vite
echo; say "Health check:"
BACKEND_URL="http://localhost:8000" FRONTEND_PORT=3000 bash scripts/check_thunity_health.sh || true

# 7) URLs + start frontend (foreground; Ctrl+C to stop the UI)
echo
echo "${BOLD}Open in your browser:${RST}"
echo "  Frontend (UI):     http://localhost:3000"
echo "  Backend health:    http://localhost:8000/api/health/local-only"
echo "  API docs:          http://localhost:8000/api/docs"
echo "  n8n:               http://localhost:5678"
echo
echo "${DIM}Docker services keep running after you stop the UI. Stop them with:  $DC stop${RST}"
echo "${DIM}If npm throws stale-module errors, run: scripts/reset_frontend_deps.sh${RST}"
echo
say "Starting frontend dev server on http://localhost:3000  (Ctrl+C to stop)…"
exec sh -c 'cd frontend && npm run dev'
