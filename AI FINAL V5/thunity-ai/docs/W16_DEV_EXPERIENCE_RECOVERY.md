# W16A — Dev Experience Recovery Pack

Goal: make Thunity **easy and predictable to start, diagnose, and view in a
browser** so UI/UX work can resume on a reliable base. No backend API, route,
auth, or frontend-behavior changes. Nothing destructive.

## Why this was needed
Every attempt to view UI progress was hitting environment errors: backend `:8000`
unreachable, Docker Compose missing env vars, Ollama port conflicts, npm/node
problems, and unclear startup steps.

## Root causes found (Phase 1 inspection)
1. **`POSTGRES_PASSWORD` was required by `docker-compose.yml` but absent from
   `.env.example`** → `docker compose up` failed immediately for everyone.
2. **Container Ollama started by default** and bound host port `11434`, conflicting
   with host Ollama on macOS.
3. **No one-command start, no health check, no doctor** — startup was tribal knowledge.
4. **No clean npm reset path** for stale `node_modules` (Joshua's complaint).
5. Backend `Dockerfile` lacked a build toolchain, risking native-wheel
   (psutil/asyncpg/cryptography) build failures.

## Changes

### Env template — `.env.example`
- Added the missing **`POSTGRES_PASSWORD`** (required by compose) plus
  `POSTGRES_USER` / `POSTGRES_DB` for clarity.
- Added `JWT_ALGORITHM`, `N8N_BASIC_AUTH_ACTIVE`, and documented optional n8n vars.
- Documented the **canonical vs alias** names so guides using generic names still
  work: `SECRET_KEY`(JWT_SECRET), `ALLOWED_ORIGINS`(CORS_ORIGINS),
  `OLLAMA_URL`(OLLAMA_HOST), `POSTGRES_URL`(DATABASE_URL),
  `JWT_EXPIRE_MINUTES`(ACCESS_TOKEN_EXPIRE_MINUTES),
  `OLLAMA_MODEL_FAST`(OLLAMA_MODEL), `OLLAMA_MODEL_EMBEDDING`(OLLAMA_EMBED_MODEL).
  Backend variable **names were not renamed** (that would break `config.py`).
- Labeled local-dev-only values; all secrets remain `CHANGE_ME` placeholders.

### Docker — `docker-compose.yml`
- Container Ollama is now **opt-in via the `ollama` profile** (so it does not bind
  `11434` by default → no Mac conflict).
- `OLLAMA_URL` is now **overridable**: `${OLLAMA_URL:-http://ollama:11434}` so Mac
  can point the backend at host Ollama.
- Removed `ollama` from `backend.depends_on` (it is reached lazily over
  `OLLAMA_URL`; this avoids a profile/dependency start error). Postgres + redis
  remain dependencies.
- No volumes changed/removed.

### Docker — `docker-compose.rocm.yml` (new)
- Linux AMD/ROCm override: `ollama/ollama:rocm` image, `/dev/kfd` + `/dev/dri`
  devices, `HSA_OVERRIDE_GFX_VERSION=10.3.0`, reusing the existing `ollama_data`
  volume. Used together with the base file and `--profile ollama`.

### Backend — `backend/Dockerfile`
- Installs `gcc python3-dev build-essential` (then cleans apt lists in the same
  layer) so native wheels build reliably.

### Scripts (all non-destructive; never `down -v`, never delete volumes/models)
| Script | Purpose |
|--------|---------|
| `scripts/start_thunity_mac.command` | Finder double-click launcher (wraps the `.sh`) |
| `scripts/start_thunity_mac.sh` | Mac: start Docker services (no container Ollama) + frontend, with health |
| `scripts/start_thunity_linux_rocm.sh` | Linux ROCm: full stack incl. container Ollama (GPU) |
| `scripts/start_thunity_windows.bat` | Optional Windows-only launcher (clearly labeled) |
| `scripts/check_thunity_health.sh` | Honest PASS/FAIL probes: Docker, compose, backend, frontend, Ollama, containers |
| `scripts/dev_doctor.sh` | Diagnose Node/Docker/.env/ports/11434-conflict/node_modules; prints next steps |
| `scripts/reset_frontend_deps.sh` | Clean reinstall of frontend deps only (node_modules + lockfile), confirm or `--yes` |

### Docs
- `docs/LOCAL_DEV_RUNBOOK.md` — Mac step-by-step, `.env` vs `frontend/.env.local`, URLs, common errors.
- `docs/JOSHUA_LINUX_ROCM_RUNBOOK.md` — Linux ROCm workflow + Mac-vs-Linux table.
- `README.md` — added a short Quick Start pointing at the scripts/docs.

## Mac vs Linux (do not mix)
- **Mac**: host Ollama on `11434`; base compose only (no `ollama` profile);
  `OLLAMA_URL=http://host.docker.internal:11434`.
- **Linux ROCm**: container Ollama (ROCm image); base **+** `docker-compose.rocm.yml`
  **+** `--profile ollama`; `OLLAMA_URL=http://ollama:11434`.

## Explicitly NOT changed
- No backend API contracts, routes, or auth logic.
- No frontend UI behavior; no UI redesign.
- No new npm dependencies; no external AI calls.
- No volumes/models deleted; no models pulled.

## Honesty / remaining blockers
- Health checks report real probe results; they never claim healthy on failure.
- This machine currently has **no Node.js/npm on PATH**, so the frontend half of
  the Mac flow can't run until Node is installed (the scripts detect this and say
  so). Docker availability and compose validity were verified (see W16 report).
