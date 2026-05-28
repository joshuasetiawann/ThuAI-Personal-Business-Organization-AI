#!/usr/bin/env bash
# ── Thunity dev doctor — diagnose common startup problems ──────────────
# READ-ONLY. Diagnoses and prints next steps. Never modifies anything,
# never deletes volumes/models, never runs docker compose down -v.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || { echo "Cannot cd to repo root"; exit 1; }

GREEN=$'\033[32m'; RED=$'\033[31m'; YEL=$'\033[33m'; DIM=$'\033[2m'; RST=$'\033[0m'
ok(){   echo "${GREEN}OK${RST}    $*"; }
bad(){  echo "${RED}ISSUE${RST} $*"; ISSUES=$((ISSUES+1)); }
warn(){ echo "${YEL}NOTE${RST}  $*"; }
step(){ echo "${DIM}      → $*${RST}"; }
ISSUES=0

port_busy(){ # port -> 0 if something is listening
  if command -v lsof >/dev/null 2>&1; then lsof -iTCP:"$1" -sTCP:LISTEN -n -P >/dev/null 2>&1; return $?; fi
  if command -v nc   >/dev/null 2>&1; then nc -z localhost "$1" >/dev/null 2>&1; return $?; fi
  return 2
}
who_on_port(){ command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$1" -sTCP:LISTEN -n -P 2>/dev/null | awk 'NR>1{print $1, "(pid "$2")"}' | sort -u | tr '\n' ' '; }

echo "── Thunity dev doctor ───────────────────────────────────────"
echo "repo: $ROOT"; echo

# 1) Node / npm
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  ok "Node $(node -v) / npm $(npm -v)"
else
  bad "Node.js / npm not found on PATH (frontend cannot build or run)"
  step "Install Node 18+ (macOS: 'brew install node', or https://nodejs.org). Then re-open the terminal."
fi

# 2) Docker daemon
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then ok "Docker daemon running"
  else bad "Docker installed but not running"; step "Start Docker Desktop and wait until it says 'running', then retry."; fi
else
  bad "Docker not found on PATH (backend/postgres/redis/n8n run via Docker)"
  step "Install Docker Desktop (Mac) or Docker Engine (Linux)."
fi

# 3) .env presence + required vars
if [ -f .env ]; then
  ok ".env present"
  missing=""
  for v in POSTGRES_PASSWORD N8N_BASIC_AUTH_PASSWORD SECRET_KEY FOUNDER_PASSWORD; do
    if ! grep -qE "^[[:space:]]*$v=" .env; then missing="$missing $v"; fi
  done
  [ -n "$missing" ] && { bad ".env is missing required vars:$missing"; step "Copy from .env.example and fill them in (compose requires POSTGRES_PASSWORD)."; }
  for v in POSTGRES_PASSWORD N8N_BASIC_AUTH_PASSWORD FOUNDER_PASSWORD; do
    if grep -qE "^[[:space:]]*$v=CHANGE_ME" .env 2>/dev/null; then warn "$v is still a CHANGE_ME placeholder in .env"; fi
  done
else
  bad ".env not found"
  step "cp .env.example .env   then edit POSTGRES_PASSWORD, N8N_BASIC_AUTH_PASSWORD, SECRET_KEY, FOUNDER_PASSWORD"
fi

# 4) Ports
echo
for p in 8000 3000 5173 11434 5432 6379 5678; do
  if port_busy "$p"; then
    case "$p" in
      8000) warn "port 8000 busy (backend?): $(who_on_port 8000)";;
      3000) warn "port 3000 busy (frontend dev?): $(who_on_port 3000)";;
      5173) warn "port 5173 busy (old vite default?): $(who_on_port 5173)";;
      11434) warn "port 11434 busy (Ollama): $(who_on_port 11434) — fine if host Ollama is intended";;
      *) warn "port $p busy: $(who_on_port $p)";;
    esac
  fi
done
step "On Mac, host Ollama on 11434 is expected. Do NOT also start container Ollama (that causes the conflict)."

# 5) Ollama 11434 conflict specifically
if port_busy 11434 && command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx thunity-ollama; then
  if [ "$(who_on_port 11434 | tr -d ' ')" != "" ]; then
    warn "Both a container (thunity-ollama) and a host process may want 11434 — pick ONE."
    step "Mac: use host Ollama and don't start container Ollama. Linux: use container Ollama and stop host 'ollama serve'."
  fi
fi

# 6) frontend node_modules + native optional binaries (rollup/esbuild)
echo
if [ -d frontend/node_modules ]; then
  ok "frontend/node_modules present"
  # The npm optional-dependency bug (npm/cli#4828) can leave the platform-native
  # rollup/esbuild binary missing, which breaks 'vite build' even though tsc passes.
  if [ -d frontend/node_modules/rollup ] && ! ls frontend/node_modules/@rollup/rollup-* >/dev/null 2>&1; then
    bad "rollup native binary missing (@rollup/rollup-*) — 'vite build' will fail"
    step "Fix with a clean reinstall: scripts/reset_frontend_deps.sh"
  fi
  if [ -d frontend/node_modules/vite ] && ! ls frontend/node_modules/@esbuild/* >/dev/null 2>&1; then
    warn "esbuild native binary may be missing (@esbuild/*) — dev/build can fail"
    step "If builds fail oddly, run: scripts/reset_frontend_deps.sh"
  fi
else
  bad "frontend/node_modules missing"; step "Run: (cd frontend && npm install)  — or scripts/reset_frontend_deps.sh"
fi

# 7) backend build toolchain hint (informational)
if [ -f backend/Dockerfile ] && grep -q 'build-essential' backend/Dockerfile; then
  ok "backend Dockerfile installs gcc/build-essential (native wheels will compile)"
else
  warn "backend Dockerfile may lack gcc — psutil/asyncpg builds could fail"
fi

echo
if [ "$ISSUES" -eq 0 ]; then
  echo "${GREEN}Doctor: no blocking issues found.${RST} Start with scripts/start_thunity_mac.sh (Mac) and check scripts/check_thunity_health.sh."
else
  echo "${RED}Doctor: $ISSUES blocking issue(s).${RST} Fix the ISSUE lines above, then re-run this doctor."
fi
exit 0
