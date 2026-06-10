# Thunity Local AI Company OS — Backend (Shot 2)

A private, **local-first**, **honest-hybrid** AI operating system for company
intelligence, decision-making, knowledge management, task execution, and workflow
governance. **Core promise: your company brain stays on your machine.**

Reasoning runs on local **Ollama** models by default. For heavy or strategic work a
single **declared, key-gated** frontier model (Claude or OpenRouter) may be used — it
is always **labelled** to the founder, there is **no silent cloud fallback**, and with
no frontier key configured the system runs **100% local**. Embeddings and all data stay
local; `LOCAL_ONLY_MODE` enforces strict local-only when set, and external providers are
never used silently. (This is the post-2026-06-06 honest-hybrid posture; see
`docs/LOCAL_ONLY_COMPLIANCE.md`.)

## Official Workspace
This folder — `PROJECT AI COMPANY/thunity-ai` — is the **one official Thunity
repo**. Do **not** use `PROJECT AI BUILDING` as an active code repo (it is
references-only), the stray `~/Projects/thunity-ai`, or any `*.zip` snapshot.
- Visual references (target mockup, brand sheets): `references/`
- Claude Code handoffs/plans: `docs/claude-code/` · Claude Max onboarding: `docs/claude-max/`
- `THUWEALTH AI` is a separate project and is never touched here.
See `docs/WORKSPACE_CONSOLIDATION.md` for the full import log (W18A).

## Quick Start (recommended)

One command per machine. Full guides: `docs/LOCAL_DEV_RUNBOOK.md` (Mac) and
`docs/JOSHUA_LINUX_ROCM_RUNBOOK.md` (Linux/AMD). Overview: `docs/W16_DEV_EXPERIENCE_RECOVERY.md`.

```bash
# macOS (Acung) — double-click scripts/start_thunity_mac.command, or:
bash scripts/start_thunity_mac.sh        # Docker services + frontend (host Ollama)

# Linux + AMD/ROCm (Joshua):
bash scripts/start_thunity_linux_rocm.sh # full stack incl. container Ollama (GPU)

# Diagnose / check anytime (non-destructive):
bash scripts/dev_doctor.sh
bash scripts/check_thunity_health.sh
# Stale frontend npm modules:
bash scripts/reset_frontend_deps.sh
```

First run creates `.env` from `.env.example` and stops so you can set
`POSTGRES_PASSWORD`, `N8N_BASIC_AUTH_PASSWORD`, `SECRET_KEY`, `FOUNDER_PASSWORD`.

URLs — Frontend: http://localhost:3000 · API docs: http://localhost:8000/api/docs ·
Health: http://localhost:8000/api/health/local-only · n8n: http://localhost:5678

## Run (Docker, manual)
```bash
cp .env.example .env          # then edit: set SECRET_KEY, POSTGRES_PASSWORD,
                              # N8N_BASIC_AUTH_PASSWORD, FOUNDER_PASSWORD
# Mac: use HOST Ollama (ollama serve) and start everything EXCEPT container Ollama:
docker compose up -d postgres redis n8n backend
# Linux/CPU container Ollama (opt-in via the 'ollama' profile):
docker compose --profile ollama up -d
# pull the local models (never auto-pulled):
docker exec -it thunity-ollama ollama pull qwen2.5:7b-instruct
docker exec -it thunity-ollama ollama pull llama3.1:8b
docker exec -it thunity-ollama ollama pull qwen2.5-coder:7b
docker exec -it thunity-ollama ollama pull nomic-embed-text
```
API docs: http://localhost:8000/api/docs · Health: http://localhost:8000/api/health/local-only

## Run (backend only, local Python)
```bash
cd backend && pip install -r requirements.txt
export POSTGRES_URL="sqlite+aiosqlite:///./thunity.db"   # or a local postgres URL
export SECRET_KEY="$(openssl rand -hex 32)"
export FOUNDER_EMAIL="founder@thunity.local" FOUNDER_PASSWORD="strong-pass"
uvicorn main:app --reload
```

## Test
```bash
cd backend && pytest -q          # runs on a local sqlite db, Ollama is mocked
python ../scripts/check-local-only.py   # fails if any forbidden cloud dependency is active
```

Frontend (Founder Command Center) is built under `frontend/` (React + Vite) — served at
http://localhost:3000. See `docs/` for architecture, security, RAG, agent council, and operating doctrine.
