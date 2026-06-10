#!/usr/bin/env bash
# ── Thunity health check — read-only, non-destructive ──────────────────
# Reports PASS/FAIL for each service. NEVER claims healthy when a probe fails.
# Touches nothing: no start/stop, no volumes, no models.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || { echo "Cannot cd to repo root"; exit 1; }

# Config (overridable via env)
BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"          # vite strictPort 3000
OLLAMA_URL="${OLLAMA_HEALTH_URL:-http://localhost:11434}"

GREEN=$'\033[32m'; RED=$'\033[31m'; YEL=$'\033[33m'; DIM=$'\033[2m'; RST=$'\033[0m'
pass(){ echo "${GREEN}PASS${RST}  $*"; }
fail(){ echo "${RED}FAIL${RST}  $*"; FAILS=$((FAILS+1)); }
warn(){ echo "${YEL}WARN${RST}  $*"; }
note(){ echo "${DIM}      $*${RST}"; }
FAILS=0

# Pick docker compose command
DC=""
if command -v docker >/dev/null 2>&1; then
  if docker compose version >/dev/null 2>&1; then DC="docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then DC="docker-compose"; fi
fi

http_ok(){ # url -> 0 if HTTP <500 reachable
  command -v curl >/dev/null 2>&1 || return 2
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 4 "$1" 2>/dev/null)" || return 1
  [ -n "$code" ] && [ "$code" != "000" ] && [ "$code" -lt 500 ]
}

echo "── Thunity health ───────────────────────────────────────────"
echo "repo: $ROOT"
echo

# 1) Docker daemon
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then pass "Docker daemon running"
  else fail "Docker installed but daemon not responding (start Docker Desktop)"; fi
else
  warn "docker not installed / not on PATH (Docker-based services can't be checked)"
fi

# 2) Compose services
if [ -n "$DC" ] && docker info >/dev/null 2>&1; then
  echo
  echo "compose services:"
  $DC ps 2>/dev/null || warn "could not run '$DC ps'"
fi

echo
# 3) Backend health (real endpoint — no faking)
if http_ok "$BACKEND_URL/api/health/local-only"; then
  pass "Backend reachable: $BACKEND_URL/api/health/local-only"
  if command -v curl >/dev/null 2>&1; then
    note "$(curl -s --max-time 4 "$BACKEND_URL/api/health/local-only" | head -c 400)"
  fi
else
  fail "Backend NOT reachable at $BACKEND_URL/api/health/local-only"
  note "Is the backend container up? Try: $DC ps   and  $DC logs backend"
fi

# 4) Frontend dev server
if http_ok "http://localhost:$FRONTEND_PORT"; then
  pass "Frontend dev server reachable: http://localhost:$FRONTEND_PORT"
else
  warn "Frontend not reachable on http://localhost:$FRONTEND_PORT (may not be started yet)"
fi

# 5) Ollama
if http_ok "$OLLAMA_URL/api/tags"; then
  pass "Ollama reachable: $OLLAMA_URL/api/tags"
  if command -v curl >/dev/null 2>&1; then
    note "models: $(curl -s --max-time 4 "$OLLAMA_URL/api/tags" | tr ',' '\n' | grep -o '"name":"[^"]*"' | head -8 | tr '\n' ' ')"
  fi
else
  warn "Ollama not reachable at $OLLAMA_URL (host Ollama not running, or container Ollama not started)"
fi

# 6) Container-level checks (best effort)
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo
  for c in thunity-postgres thunity-redis thunity-n8n; do
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$c"; then
      pass "container up: $c"
    else
      warn "container not running: $c"
    fi
  done
fi

echo
if [ "$FAILS" -eq 0 ]; then
  echo "${GREEN}Summary: no hard failures.${RST} (WARN items may be services you haven't started.)"
  exit 0
else
  echo "${RED}Summary: $FAILS failing check(s).${RST} See notes above; run scripts/dev_doctor.sh for guidance."
  exit 1
fi
