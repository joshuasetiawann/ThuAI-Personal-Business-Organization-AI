#!/usr/bin/env bash
# ── Thunity — one-command start for Joshua's Linux AMD / ROCm box ──────
# Starts the FULL stack INCLUDING container Ollama on ROCm (AMD GPU), using
# docker-compose.yml + docker-compose.rocm.yml with the 'ollama' profile.
#
# DO NOT use this on a Mac — the ROCm image needs /dev/kfd and /dev/dri.
# SAFE: never 'docker compose down -v', never deletes volumes/models.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || { echo "Cannot cd to repo root"; exit 1; }

GREEN=$'\033[32m'; RED=$'\033[31m'; YEL=$'\033[33m'; BOLD=$'\033[1m'; DIM=$'\033[2m'; RST=$'\033[0m'
say(){ echo "${BOLD}» $*${RST}"; }
ok(){ echo "${GREEN}OK${RST}   $*"; }
bad(){ echo "${RED}STOP${RST} $*"; }
warn(){ echo "${YEL}WARN${RST} $*"; }

[ -f docker-compose.yml ] && [ -f docker-compose.rocm.yml ] || { bad "Missing compose files in repo root."; exit 1; }

echo "${BOLD}── Thunity • Linux ROCm start ────────────────────────────${RST}"
echo "repo: $ROOT"; echo
warn "This launcher is for LINUX with an AMD GPU (ROCm). Not for macOS."

# 1) Docker
command -v docker >/dev/null 2>&1 || { bad "Docker not installed."; exit 1; }
docker info >/dev/null 2>&1 || { bad "Docker daemon not running (try: sudo systemctl start docker)."; exit 1; }
DC="docker compose"; docker compose version >/dev/null 2>&1 || DC="docker-compose"
ok "Docker ready ($DC)"

# 2) AMD GPU devices present?
if [ -e /dev/kfd ] && [ -e /dev/dri ]; then ok "AMD GPU devices present (/dev/kfd, /dev/dri)"
else warn "/dev/kfd or /dev/dri not found — ROCm Ollama may fail. Confirm AMD drivers/ROCm are installed."; fi

# 3) .env
if [ ! -f .env ]; then
  cp .env.example .env
  warn ".env was missing — created from .env.example. Set POSTGRES_PASSWORD, N8N_BASIC_AUTH_PASSWORD, SECRET_KEY, FOUNDER_PASSWORD, then re-run."
  exit 0
fi
miss=""; for v in POSTGRES_PASSWORD N8N_BASIC_AUTH_PASSWORD; do grep -qE "^[[:space:]]*$v=" .env || miss="$miss $v"; done
[ -n "$miss" ] && { bad ".env missing required var(s):$miss"; exit 1; }
ok ".env present with required vars"

# 4) Start full stack incl. ROCm Ollama (profile 'ollama' + rocm override)
#    Container Ollama is used here, so backend points at the in-network service.
export OLLAMA_URL="http://ollama:11434"
say "Starting full stack (postgres, redis, n8n, backend, ROCm ollama)…"
if ! $DC -f docker-compose.yml -f docker-compose.rocm.yml --profile ollama up -d; then
  bad "docker compose failed. Run: scripts/dev_doctor.sh and check 'docker compose ... logs'."
  exit 1
fi
ok "Stack requested. Waiting for services…"
sleep 8

# 5) Health
echo; say "Health check:"
BACKEND_URL="http://localhost:8000" FRONTEND_PORT=3000 OLLAMA_HEALTH_URL="http://localhost:11434" bash scripts/check_thunity_health.sh || true

echo
echo "${BOLD}Open in your browser:${RST}"
echo "  Backend health:  http://localhost:8000/api/health/local-only"
echo "  API docs:        http://localhost:8000/api/docs"
echo "  n8n:             http://localhost:5678"
echo
echo "${DIM}Models are NOT auto-pulled. Pull into the container when ready, e.g.:${RST}"
echo "${DIM}  docker exec -it thunity-ollama ollama pull qwen2.5:7b-instruct${RST}"
echo
echo "${DIM}Frontend: run separately ->  (cd frontend && npm install && npm run dev)  # http://localhost:3000${RST}"
echo "${DIM}Stop the stack (KEEPS data):  $DC -f docker-compose.yml -f docker-compose.rocm.yml stop${RST}"
