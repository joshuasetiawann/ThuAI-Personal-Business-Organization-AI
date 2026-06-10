# Thunity — Sprint 9 Docs & Readiness Prep

Parallel-support deliverable for **PARALLEL-SPRINT-9-DOCS-AND-READINESS-PREP**
(REVIEW_AND_DRAFT_ONLY). Reviewed the uploaded backend (`Salinan PROJECT AI COMPANY
5.zip` → `thunity-ai/`). **No backend code was modified.** These are drafts for the main
(code-executing) Claude to place into the repo's `docs/` and act on.

## Project structure summary

`thunity-ai/` is the Shot 2 backend (FastAPI + async SQLAlchemy, local stack via
`docker-compose`: ollama, postgres, redis, n8n, backend). The repo's `docs/` is currently
**empty** — all 12 docs below are new.

```
backend/
  main.py config.py requirements.txt Dockerfile
  core/        local_only · security · permissions · audit · errors
  agents/      council · model_router · ollama_client · prompts · contracts/
  db/          base (GUID/JSONType, async engine) · models (single source of truth)
  services/    council deps, knowledge/RAG, file, embedding, decision, task,
               approval, workflow, sandbox, dataset, metrics, hardware, bootstrap
  api/routes/  auth health agents conversations knowledge files datasets decisions
               tasks approvals workflows models metrics hardware audit tools sandbox settings
  tools/       registry · executor · schemas
  adapters/optional/  supabase_sync (quarantined, disabled, gated)
  alembic/     versions/0001_initial.py
  tests/       6 suites + conftest (local SQLite, Ollama mocked, n8n disabled)
scripts/       backup-local.sh · restore-local.sh · check-local-only.py
docker-compose.yml · .env.example · README.md
```

Verification this session: `py_compile` over all backend `*.py` **passed (exit 0)**. Full
`pytest` was **not run** (sandbox has no network to install FastAPI/SQLAlchemy/etc.) — no
claim is made that tests pass. See `docs/TESTING.md`.

## Documentation draft index (`docs/`)

1. `OPERATING_DOCTRINE.md` — principles: local-only, hardware humility, human governance,
   auditability, honesty.
2. `LOCAL_ONLY_COMPLIANCE.md` — the guard, the quarantined adapter, health endpoint,
   `check-local-only.py`.
3. `HARDWARE_PROFILE.md` — RX 6600 XT 8GB / Ryzen 7 5800X / 16GB; 7B/8B policy; sequential
   execution; CPU-fallback honesty.
4. `AGENT_COUNCIL.md` — 6 sequential stages, role→model map, decision contract, prompt
   versioning, persistence.
5. `BACKEND_ARCHITECTURE.md` — layers, local stack, DB portability, startup, error
   contract.
6. `API_OVERVIEW.md` — full endpoint catalog by router.
7. `SECURITY_BASELINE.md` — bcrypt/JWT/RBAC, secret hygiene, CORS, file safety, audit
   immutability.
8. `RAG_PIPELINE.md` — ingest→chunk→embed→store→retrieve→ground; local vector store;
   limits.
9. `DECISION_TASK_APPROVAL.md` — ledger, mission board, approval tiers, gated execution.
10. `WORKFLOW_TOOL_GOVERNANCE.md` — allow-listed workflows, tool registry enforcement,
    sandbox limitation.
11. `BACKUP_RESTORE.md` — local-only backup excluding `.env`; restore; optional GPG.
12. `TESTING.md` — commands, harness, coverage, honest verification status.

## Review outputs (`reviews/`)

- `MISSING_TESTS_CHECKLIST.md` — concrete tests to add (backup `.env` exclusion, hardware
  auth+shape, local-only health/scanner, audit no-mutation, import smoke).
- `BACKEND_READINESS_CHECKLIST.md` — ✅/🟡/⛔ status across every subsystem.
- `SPRINT9_IMPLEMENTATION_FOR_MAIN_CLAUDE.md` — prioritized action list (code-executing
  Claude).
- `GROK_REDTEAM_CHECKLIST.md` — adversarial review for after Sprint 9.
- `GEMINI_QA_CHECKLIST.md` — functional QA for after Sprint 9.

## Top findings (honest)

- Strong local-only enforcement, governance, and audit posture; honest failure handling
  throughout.
- `docs/` is empty → these drafts fill it.
- Test gaps: hardware endpoint, `/api/health/local-only`, backup `.env` exclusion,
  local-only scanner as a test, import smoke.
- Judgment calls (not bugs): backend publishes `0.0.0.0:8000` (rest of stack is
  127.0.0.1); Alembic baseline exists but startup uses `create_all`; sandbox executes
  nothing yet; GPU acceleration unconfirmed on gfx1032 by design.
