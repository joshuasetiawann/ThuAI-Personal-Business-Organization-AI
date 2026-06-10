# Final Backend Readiness Checklist (pre–Shot 3)

Legend: ✅ implemented & covered by an existing test · 🟡 implemented, **needs a final
check / test** · ⛔ not done / known limitation. Test status reflects reading the code;
the suite was **not executed** in this review (see `docs/TESTING.md`).

## Local-only compliance
- ✅ `LOCAL_ONLY_MODE` default true; guard raises + audits; Supabase adapter quarantined.
- ✅ No cloud provider config field; `compliance_status()` surfaced via health/settings.
- 🟡 `scripts/check-local-only.py` — run it and confirm exit 0 on the final tree.
- 🟡 `/api/health/local-only` returns `compliant` — add a test.

## Auth & security
- ✅ bcrypt hashing, JWT, no hardcoded creds, founder-from-env bootstrap.
- ✅ RBAC roles/permissions; `require_role` / `require_permission`.
- ✅ CORS not wildcard; secrets redacted in audit + settings; no stack-trace leak.
- ✅ Path-traversal protection in file service.
- 🟡 Production `startup_safety_check` — verify it blocks every insecure default in a
  production smoke run.
- 🟡 **Network exposure** — backend publishes `0.0.0.0:8000`; consider binding
  `127.0.0.1:8000` to match the rest of the stack.

## AI Council
- ✅ 4 agents + evaluator, sequential, local Ollama only, no cloud fallback.
- ✅ Full run persists `agent_runs` / `agent_messages` / `evaluations` / `model_usage`.
- ✅ Prompt versioning (DB authoritative); synthesizer section contract enforced.
- 🟡 Behaviour with a **real** Ollama on the target GPU (latency, CPU-fallback) — manual
  check; tests only mock Ollama.

## Knowledge / RAG
- ✅ Local ingest→chunk→embed→store; cosine retrieval; trust/lifecycle filtering; grounding.
- ✅ Embeddings local-only (asserted by source inspection).
- ⛔ Vector search is linear cosine (no ANN). `pgvector` is the documented upgrade.

## Governance (decisions / tasks / approvals)
- ✅ Decision lifecycle + traceability; tasks; approval tiers; critical confirmation phrase.
- ✅ Gated high-risk decision execution.

## Workflow & tool governance
- ✅ Allow-listed workflows; arbitrary rejected + audited; high-risk approval gate; runs persisted.
- ✅ Tool registry enforcement (unregistered blocked, permission enforced, approval gate, honest `not_implemented`).
- ⛔ Sandbox executes nothing yet (intent/log registry only) — documented limitation.

## Observability / audit
- ✅ Real metrics aggregations over persisted data; audit append-only (no delete route).
- ✅ Global error handler persists `ErrorLog` without leaking details.

## Backup / restore
- 🟡 `backup-local.sh` / `restore-local.sh` exist and exclude the real `.env` by design —
  **run a real backup+restore round-trip** and add the `.env`-exclusion test.
- 🟡 `last_backup` freshness shows in metrics — confirm after a real backup.

## Hardware awareness
- ✅ `/api/hardware/status` returns CPU/RAM/disk/GPU + CPU-fallback warning + missing models.
- 🟡 Add auth + shape tests (currently untested).
- ⛔ GPU acceleration on gfx1032 is unconfirmed by design — verify on the real machine.

## Config / migrations
- ✅ DB-agnostic models (Postgres/SQLite); idempotent bootstrap seeding.
- 🟡 **Alembic vs `create_all`** — startup uses `create_all`, but a baseline migration
  exists. Decide the production-authoritative path and confirm the migration matches
  `db/models.py`.

## Docs & tests
- 🟡 Add the 12 `docs/*.md` (drafts in `../docs/`) into the repo's `docs/`.
- 🟡 Run `pytest -q` + `check-local-only.py`; record results.
- 🟡 Add the missing tests (`MISSING_TESTS_CHECKLIST.md`).

## Pending per task spec
Sprint 9 finalization · docs · backup/restore final check · hardware-awareness final
check · final test/readiness review · final Grok/Gemini backend review before Shot 3.
