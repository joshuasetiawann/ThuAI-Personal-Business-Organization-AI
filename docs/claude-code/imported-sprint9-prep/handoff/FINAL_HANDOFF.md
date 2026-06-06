# Sprint 9 — Final Compact Handoff (for Main Claude)

Refinement of the existing `thunity-sprint9-prep/` package. No re-audit. Apply in order.
Honest status: full `pytest` was **not** run during prep (no network for deps); only
`py_compile` passed. Nothing is claimed green until Main Claude runs it.

## 1. Exact Docs Integration Map

Source = `thunity-sprint9-prep/docs/<FILE>` → Destination = `thunity-ai/docs/<FILE>`.

| File | Copy mode | Key accuracy check before commit |
|------|-----------|----------------------------------|
| OPERATING_DOCTRINE.md | direct | Shot 3 still "not built here"; core promise wording intact |
| LOCAL_ONLY_COMPLIANCE.md | direct | Health keys + scanner categories match `core/local_only.py` & `routes/health.py`; 0.0.0.0:8000 and n8n-outbound caveats still true |
| HARDWARE_PROFILE.md | direct | Model defaults match `config.py`; `/api/hardware/status` still auth-gated |
| AGENT_COUNCIL.md | direct | 5 persisted stages (analyst ×2) + synthesizer section headers match `agents/prompts.py` |
| BACKEND_ARCHITECTURE.md | direct | Router list + startup sequence match `main.py`; Alembic-vs-`create_all` note still applies |
| API_OVERVIEW.md | adapt-light | Endpoint list matches current `api/routes/*` decorators (most drift-prone if routes added) |
| SECURITY_BASELINE.md | direct | RBAC grants match `permissions.py`; redaction keys match `audit._scrub`; binding note |
| RAG_PIPELINE.md | direct | `CHUNK_CHARS=900`/overlap 120, SUPPORTED types, excluded statuses match `knowledge_service.py` |
| DECISION_TASK_APPROVAL.md | direct | Status sets + approval tiers (admin=low/med, critical phrase `APPROVE DELETE`) match services |
| WORKFLOW_TOOL_GOVERNANCE.md | direct | The 6 allow-listed workflows + risks and the registered tool list match `registry.py`/`workflow_service.py` |
| BACKUP_RESTORE.md | direct | Backup excludes real `.env`, includes `.env.example`; GPG var `BACKUP_GPG_RECIPIENT` |
| TESTING.md | **adapt (required)** | Replace the "tests NOT run" note with real `pytest` counts once executed |

## 2. Minimal Sprint 9 Tests To Add (only what matters before Shot 3)

Local-only, Ollama-free, using existing `conftest.py` fixtures (`client`,`founder_token`).

| # | Test | Target file | Type | Minimal assertion |
|---|------|-------------|------|-------------------|
| 1 | `test_backup_restore_scripts_exist` | `tests/test_backup_restore.py` (new) | unit | both scripts exist & `os.access(p, os.X_OK)` |
| 2 | `test_backup_excludes_real_env` | `tests/test_backup_restore.py` | integration | run script in temp ROOT; archive has `.env.example`, **no** `.env` |
| 3 | `test_hardware_status_requires_auth` | `tests/test_hardware.py` (new) | smoke | `client.get("/api/hardware/status").status_code == 401` |
| 4 | `test_hardware_status_shape` | `tests/test_hardware.py` | integration | with token: body has `cpu,ram,disk,gpu,gpu_acceleration_confirmed,ollama.missing_models` |
| 5 | `test_local_only_health_shape` | `tests/test_local_only_health.py` (new) | integration | `/api/health/local-only` → `local_only_mode True`, `external_ai_providers_enabled False`, `status=="compliant"` |
| 6 | `test_check_local_only_passes` | `tests/test_local_only_health.py` | integration | `subprocess` run of `scripts/check-local-only.py` → returncode 0, `"PASS"` in stdout |
| 7 | `test_audit_append_only_routes` | `test_workflow_tool_observability.py` (extend) | smoke | `PUT`/`PATCH`/`DELETE` on `/api/audit` ∈ {404,405} |
| 8 | `test_app_import_smoke` | `tests/test_smoke_imports.py` (new) | smoke | `import main` succeeds; `main.app` truthy |
| 9 | `test_major_routers_mounted` | `tests/test_smoke_imports.py` | smoke | `{r.path for r in main.app.routes}` covers `/api/auth/login`,`/api/agents/council`,`/api/hardware/status`,`/api/health/local-only`,`/api/audit`,`/api/settings` |

Rule: never weaken a guard to make a test pass. Tests 2 & 6 run from repo root (set `cwd`);
the pg step degrades gracefully without Docker.

## 3. Main Claude Apply Prompt

See `handoff/MAIN_CLAUDE_APPLY_PROMPT.yaml` (paste-ready YAML; mirrored below).

## 4. Final Backend Gate Before Shot 3 (strict — all must hold)

- [ ] `python -c "import main"` (from `backend/`) imports with no error.
- [ ] `python scripts/check-local-only.py` → exit 0 / "PASS".
- [ ] `cd backend && pytest -q` passes **or** exact blockers reported (test ids + reason).
- [ ] `thunity-ai/docs/` populated with all 12 docs.
- [ ] Backup/restore docs exist (`docs/BACKUP_RESTORE.md`) and scripts verified by test 1–2.
- [ ] `/api/hardware/status` works (auth + shape) **or** the GPU-acceleration limitation is documented.
- [ ] No cloud fallback anywhere (scanner clean; `LOCAL_ONLY_MODE` default true).
- [ ] Sensitive routes still return 401 unauthenticated (`test_security.py` green).
- [ ] Workflow/tool governance still enforced (allow-list + registry + approval gates green).

If any item fails, do not proceed to Shot 3; report the blocker.

## 5. Grok Final Red-Team Prompt (short)

> Red-team the attached **Thunity Local AI Company OS** backend before its frontend phase.
> Promise: "your company brain stays on your machine" — local Ollama only, local
> Postgres/Redis/n8n, no cloud AI path, bcrypt/JWT + RBAC, approval gates for high/critical
> actions, allow-listed workflows, registered tools, append-only audit. Try to break it:
> (1) escape local-only (config flips, n8n outbound, any external call — confirm prod
> startup refuses and attempts are audited); (2) auth/RBAC bypass + JWT forgery +
> cross-user access; (3) governance bypass (execute high-risk without approval, critical
> without the phrase, unregistered tool, non-allow-listed workflow); (4) secret/data
> leakage (`/api/settings`, errors, audit, backups excluding real `.env`); (5) path
> traversal + malicious file uploads; (6) prompt injection via knowledge docs; (7) LAN
> exposure of `0.0.0.0:8000`; (8) audit tampering + DoS via the heavy 14B model. Return a
> severity×likelihood findings table with repros and **local-only-preserving** fixes; mark
> documented limitations (gfx1032 GPU, linear-cosine search, sandbox no-exec) as residual
> risk, not bugs. Flag any doc that overstates the code.

## 6. Gemini Final QA Prompt (short)

> Final functional QA of the attached **Thunity Local AI Company OS** backend (+`docs/`)
> before Shot 3. Verify, pass/fail with repro: (1) `docker compose up -d` + idempotent
> bootstrap; (2) gates — `pytest -q` green (record counts) and `check-local-only.py`
> exit 0; (3) RBAC matrix across founder/admin/operator/analyst/viewer; (4) council returns
> 5 stages + evaluation with the mandatory synthesizer sections, persists conversation
> memory, records an Ollama-offline stage as `failed`; (5) RAG ingest→search→grounding per
> file type, deprecated/archived excluded, low-trust warnings; (6) decision→approve→gated
> execute, critical confirmation phrase; (7) workflow allow-list + approval gate, tool
> registry honest `not_implemented`; (8) metrics counts reconcile with DB; backup→restore
> round-trip excludes real `.env`; `/api/hardware/status` shape correct. (9) Cross-check
> every `docs/*.md` vs code and list drift. End with "ready for Shot 3? yes/no + blockers".
