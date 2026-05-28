# Thunity — Local Dev Runbook (MacBook)

The fastest reliable way to start Thunity on Acung's MacBook and view the UI in a
browser. This is the **Mac** workflow. Joshua's Linux/ROCm box has a separate
runbook: `docs/JOSHUA_LINUX_ROCM_RUNBOOK.md`.

> Nothing in this runbook deletes data. No `docker compose down -v`, no volume or
> model deletion, no model pulls. Health is reported honestly (PASS/FAIL).

---

## 0. One-time prerequisites

| Tool | Why | Install |
|------|-----|---------|
| Docker Desktop | runs postgres, redis, n8n, backend | https://www.docker.com/products/docker-desktop |
| Node.js 18+ (`node`, `npm`) | builds/runs the Vite frontend | `brew install node` or https://nodejs.org |
| Ollama (host) | local AI models the backend talks to | `brew install ollama` then `ollama serve` |

On a Mac, **Ollama runs on the host** (port 11434). The backend container reaches
it via `host.docker.internal`. We do **not** start a container Ollama on Mac —
that would fight the host for port 11434 (a frequent past error).

---

## 1. Start everything (one command)

Double-click **`scripts/start_thunity_mac.command`** in Finder, or in a terminal:

```bash
cd "<repo root>"
bash scripts/start_thunity_mac.sh
```

What it does, in order:
1. Verifies Docker is installed and running.
2. Creates `.env` from `.env.example` if missing — then **stops so you can set secrets**.
3. Points the backend at host Ollama (`OLLAMA_URL=http://host.docker.internal:11434`).
4. Starts **postgres, redis, n8n, backend** (NOT container Ollama).
5. Installs frontend deps if `frontend/node_modules` is missing.
6. Runs a health check and prints **PASS/FAIL**.
7. Prints the browser URLs and starts the Vite dev server on **http://localhost:3000**.

Stop the UI with `Ctrl+C`. The Docker services keep running; stop them (data kept)
with `docker compose stop`.

---

## 2. The `.env` file (and `frontend/.env.local`)

- **`.env`** (repo root) configures the **backend + Docker services**. It is
  git-ignored. Copy it from `.env.example` and set, at minimum:
  - `POSTGRES_PASSWORD` — **required**; compose refuses to start without it.
  - `N8N_BASIC_AUTH_PASSWORD` — required by the n8n service.
  - `SECRET_KEY` — `openssl rand -hex 32`.
  - `FOUNDER_PASSWORD` — your first-login password (email = `FOUNDER_EMAIL`).
- **`frontend/.env.local`** (optional) configures the **frontend** only. The app
  defaults to `http://localhost:8000`. Override only if your backend is elsewhere:
  ```bash
  echo 'VITE_API_URL=http://localhost:8000' > frontend/.env.local
  ```

> Naming note: this project uses `OLLAMA_URL` (not `OLLAMA_HOST`), `ALLOWED_ORIGINS`
> (not `CORS_ORIGINS`), `SECRET_KEY` (not `JWT_SECRET`), `POSTGRES_URL` (not
> `DATABASE_URL`). `.env.example` documents the aliases inline.

---

## 3. Open the app

| What | URL |
|------|-----|
| Frontend (UI) | http://localhost:3000 |
| Backend health (local-only) | http://localhost:8000/api/health/local-only |
| API docs | http://localhost:8000/api/docs |
| n8n | http://localhost:5678 |

First login uses `FOUNDER_EMAIL` / `FOUNDER_PASSWORD` from `.env`.

---

## 4. Check health any time

```bash
bash scripts/check_thunity_health.sh
```
Reports Docker daemon, compose services, backend, frontend, Ollama, and the
postgres/redis/n8n containers. It never claims healthy when a probe fails.

---

## 5. Common errors → fixes

| Symptom | Cause | Fix |
|--------|-------|-----|
| `POSTGRES_PASSWORD ... not set` on compose up | `.env` missing the var | Add `POSTGRES_PASSWORD` to `.env` (see `.env.example`) |
| Backend `:8000` not reachable | backend container not up / still booting | `docker compose ps`, `docker compose logs backend`; wait ~10s |
| Port 11434 conflict | container Ollama AND host Ollama both running | On Mac use **host** Ollama only; don't start container Ollama |
| AI replies fail, app otherwise works | host Ollama not running | `ollama serve` (then pull a model yourself) |
| `npm` errors / stale modules | corrupt `node_modules` | `bash scripts/reset_frontend_deps.sh` |
| `node: command not found` | Node not installed | `brew install node`, reopen terminal |
| Vite won't bind | port 3000 already in use | free it (`lsof -iTCP:3000 -sTCP:LISTEN`) or stop the other app |
| Anything unclear | — | `bash scripts/dev_doctor.sh` for a guided diagnosis |

---

## 6. Diagnose without changing anything

```bash
bash scripts/dev_doctor.sh
```
Checks Node/npm, Docker, `.env` vars, busy ports, the 11434 conflict, and
`node_modules`, then prints next steps. It modifies nothing.
