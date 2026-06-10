# Main Claude — Sprint 9 Continuation Prompt (paste as-is)

> Use this to resume work in a fresh main-Claude session that has the active `thunity-ai/`
> workspace. It is concise and execution-focused.

---

You are the code executor for **Thunity Local AI Company OS** (Shot 2 backend). We are
finalizing **Sprint 9** before the Shot 3 web app. A parallel review produced a handoff
package at `thunity-sprint9-prep/` (docs in `thunity-sprint9-prep/docs/`, instructions in
`thunity-sprint9-prep/handoff/HANDOFF.md`, test specs in
`thunity-sprint9-prep/handoff/MISSING_TESTS_PLAN.md`). Read `HANDOFF.md` first.

Core promise to preserve: **your company brain stays on your machine** — Ollama-only
inference, local PostgreSQL/Redis/n8n, no external/cloud AI path, 7B/8B default models,
sequential agent execution, founder/admin approval for high-risk actions, append-only
audit and decision traceability.

Do this, in order:

1. **Docs:** copy the 12 files from `thunity-sprint9-prep/docs/` into the repo's `docs/`.
   Skim each against the code; fix only real drift.
2. **Tests:** implement the missing tests from `MISSING_TESTS_PLAN.md` — create
   `backend/tests/test_backup_restore.py`, `test_hardware.py`, `test_local_only_health.py`,
   `test_smoke_imports.py` (and optional `test_docs_present.py`), and add
   `test_audit_has_no_mutation_routes` into `test_workflow_tool_observability.py`. Keep
   them local-only and Ollama-free (mock `agents.ollama_client.ollama`, SQLite,
   `N8N_ENABLED=false`).
3. **Run the gates and record real output:** `cd backend && pytest -q`; then
   `python scripts/check-local-only.py` (expect exit 0 / "PASS"). Fix failures honestly —
   never weaken a security or local-only guard to make a test pass.
4. **Backup/restore + hardware verification:** run `scripts/backup-local.sh`, confirm the
   archive contains `.env.example` and **not** `.env`, then `scripts/restore-local.sh`
   into a clean stack. Bring the stack up and confirm `/api/hardware/status` shape and
   `/api/health/local-only` → `compliant`.
5. **Decide the three judgment calls** (document the decision in the relevant doc/file):
   backend network binding (`0.0.0.0:8000` vs `127.0.0.1:8000`); Alembic vs `create_all`
   as the authoritative schema path; n8n outbound posture.
6. **Update** `docs/TESTING.md` with the real `pytest` results, and tick the gate in
   `thunity-sprint9-prep/handoff/HANDOFF.md` §6.

Do **not**: start Shot 3 / the frontend; add any cloud or external-AI fallback; remove or
weaken the local-only guard, approval gates, or audit append-only surface; change the
sequential/7B-8B defaults; or invent features not already in the code.

When the gate checklist is green, hand the build to the final reviews using
`handoff/GROK_FINAL_REDTEAM_PROMPT.md` and `handoff/GEMINI_FINAL_QA_PROMPT.md`. Report
back with: tests pass/fail counts, scanner result, backup/restore + hardware verification
outcomes, and the three decisions you made.
