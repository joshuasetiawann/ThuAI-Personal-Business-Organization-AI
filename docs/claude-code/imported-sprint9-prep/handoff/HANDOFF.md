# Sprint 9 Handoff Package — for Main Claude

**Project:** Thunity Local AI Company OS · **Phase:** Shot 2, Sprint 9 finalization
(before the Shot 3 web app). **Prepared by:** parallel Claude (review/handoff only — no
backend code was modified). This package is designed to be **applied after a context
reset**: read this file top-to-bottom, then execute the steps in order.

Paths below are relative to the repo root `thunity-ai/`. Handoff sources live in this
`thunity-sprint9-prep/` folder (a separate deliverable, not inside the repo).

---

## 1. Executive Handoff Summary

The Shot 2 backend is functionally complete and internally consistent: strong local-only
enforcement, DB-backed auth (bcrypt/JWT), RBAC, the sequential 4-agent council + evaluator
with full persistence, local RAG with source grounding, the decision/task/approval
governance layer, allow-listed workflow + registered-tool governance, real observability,
append-only audit, and local-only backups. Failure handling is honest throughout
(`failed`/`skipped`/`not_implemented` are never faked).

What remains for Sprint 9 is **finalization, not new features**:

1. The repo's `docs/` is **empty** → add the 12 finalized docs (provided here).
2. A handful of **test gaps** exist (hardware endpoint, local-only health, backup `.env`
   exclusion, compliance scanner as a test, audit no-mutation, import smoke).
3. **Run the gates** (`pytest`, `check-local-only.py`) and a real **backup/restore** and
   **hardware** verification — and record the results.
4. Decide three **judgment calls** (not bugs): backend network binding, Alembic vs
   `create_all`, and n8n outbound posture.
5. Then commission the **final Grok red-team + Gemini QA** before Shot 3.

Honest status: in the review session the full `pytest` suite was **not run** (no network
to install FastAPI/SQLAlchemy/etc.); only `python -m py_compile` over all backend `*.py`
passed (exit 0). Do not treat tests as green until you run them.

---

## 2. Docs To Add (copy into `docs/`)

The 12 files are finalized in `thunity-sprint9-prep/docs/`. Copy each to the repo's
`docs/` unchanged (review once, adjust only if code has drifted):

| Source (this package) | Destination (repo) |
|---|---|
| `docs/OPERATING_DOCTRINE.md` | `docs/OPERATING_DOCTRINE.md` |
| `docs/LOCAL_ONLY_COMPLIANCE.md` | `docs/LOCAL_ONLY_COMPLIANCE.md` |
| `docs/HARDWARE_PROFILE.md` | `docs/HARDWARE_PROFILE.md` |
| `docs/AGENT_COUNCIL.md` | `docs/AGENT_COUNCIL.md` |
| `docs/BACKEND_ARCHITECTURE.md` | `docs/BACKEND_ARCHITECTURE.md` |
| `docs/API_OVERVIEW.md` | `docs/API_OVERVIEW.md` |
| `docs/SECURITY_BASELINE.md` | `docs/SECURITY_BASELINE.md` |
| `docs/RAG_PIPELINE.md` | `docs/RAG_PIPELINE.md` |
| `docs/DECISION_TASK_APPROVAL.md` | `docs/DECISION_TASK_APPROVAL.md` |
| `docs/WORKFLOW_TOOL_GOVERNANCE.md` | `docs/WORKFLOW_TOOL_GOVERNANCE.md` |
| `docs/BACKUP_RESTORE.md` | `docs/BACKUP_RESTORE.md` |
| `docs/TESTING.md` | `docs/TESTING.md` |

Each doc is concise, implementation-grounded, local-only by default, and states its known
limitations (GPU acceleration unconfirmed on gfx1032; linear-cosine vector search; sandbox
executes nothing yet; backend network binding). They reflect the actual code: Ollama-only
inference, local Postgres/Redis/n8n, 7B/8B default model policy, sequential execution,
founder/admin approval for high-risk actions, and full audit/decision traceability.

---

## 3. Missing Tests To Add

Full specs (name · target file · purpose · minimal assertion · type) are in
`handoff/MISSING_TESTS_PLAN.md`. Priority order:

1. `test_backup_excludes_real_env` (integration) — protects secrets; highest value.
2. `test_hardware_status_requires_auth` + `test_hardware_status_structured_shape`.
3. `test_local_only_health_compliant` + `test_assert_local_only_raises` +
   `test_check_local_only_script_passes`.
4. `test_audit_has_no_mutation_routes` (extend existing suite).
5. `test_app_imports_and_routers_mounted` + `test_required_models_are_local_only`.
6. (optional) `test_required_docs_present`.

All are local-only and Ollama-free, matching `conftest.py`. Do not weaken a guard to make
a test pass.

---

## 4. Main Claude Implementation Instructions (file-by-file)

**Create (new files):**
- `docs/` ← the 12 markdown files from §2.
- `backend/tests/test_backup_restore.py` ← tests 1–2.
- `backend/tests/test_hardware.py` ← tests 3–4.
- `backend/tests/test_local_only_health.py` ← tests 5–7.
- `backend/tests/test_smoke_imports.py` ← tests 9–10.
- `backend/tests/test_docs_present.py` ← test 11 (optional).

**Update (existing files):**
- `backend/tests/test_workflow_tool_observability.py` ← add test 8
  (`test_audit_has_no_mutation_routes`) next to the existing
  `test_audit_listable_and_no_delete_route`.

**Decide + (optionally) change — judgment calls, document the decision either way:**
- `docker-compose.yml` (backend service `ports`) and `backend/config.py`
  (`BACKEND_HOST`): the backend publishes `0.0.0.0:8000` while ollama/postgres/redis/n8n
  bind `127.0.0.1`. For a pure single-machine posture, change to `"127.0.0.1:8000:8000"`
  and `BACKEND_HOST=127.0.0.1`. (If a future Shot 3 frontend on the LAN needs it, keep as
  is and document why.)
- Migrations: startup uses `Base.metadata.create_all`, but
  `backend/alembic/versions/0001_initial.py` exists. Choose the production-authoritative
  path; if Alembic, wire `alembic upgrade head` and confirm parity with `db/models.py`.
- n8n outbound: the allow-list governs which workflows the backend triggers, but n8n
  workflow *contents* can call external URLs. Document the operational constraint in
  `docs/LOCAL_ONLY_COMPLIANCE.md` (already noted there).

**What main Claude must NOT change:**
- The local-only guard (`core/local_only.py`) and the no-cloud-fallback policy.
- The sequential execution defaults (`AGENT_EXECUTION_MODE=sequential`,
  `MAX_PARALLEL_AGENT_RUNS=1`) and the 7B/8B default model policy; the 14B model stays
  opt-in/manual.
- The approval gates (high/critical require approval; critical needs the confirmation
  phrase; AI never self-approves).
- The audit append-only surface (no delete/update routes).
- Honest status reporting (`not_implemented`/`skipped`/`failed`).
- Do not start Shot 3. Do not add any cloud/external AI path. Do not add features not
  already present.

---

## 5. Commands Main Claude Must Run (and record output)

From the repo root unless noted. Record real output; do not assume green.

```bash
# 1. Test + compliance gates
cd backend && pytest -q
cd .. && python scripts/check-local-only.py        # expect exit 0 / "PASS"

# 2. Backup / restore round-trip (local)
bash scripts/backup-local.sh                        # writes data/backups/thunity_backup_*.tgz
tar -tzf data/backups/thunity_backup_*.tgz          # confirm .env.example present, .env ABSENT
bash scripts/restore-local.sh data/backups/thunity_backup_*.tgz

# 3. Hardware endpoint (needs the stack up + a token)
docker compose up -d
# obtain a founder token via POST /api/auth/login, then:
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/hardware/status
curl -s http://localhost:8000/api/health/local-only   # expect status: compliant

# 4. Model availability (never auto-pulled)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/models/health
```

Capture results into the readiness checklist (§6). If `pytest` reports failures, fix the
code or the test honestly — never relax a security/local-only guard to pass.

---

## 6. Final Backend Readiness Checklist (gate before Shot 3)

Mark each ✅ only when actually verified (command output captured).

**Compliance & security**
- [ ] `pytest -q` passes; counts recorded.
- [ ] `check-local-only.py` exits 0 / "PASS".
- [ ] `/api/health/local-only` → `compliant`; `external_ai_providers_enabled=false`.
- [ ] Production `startup_safety_check` blocks every insecure default (manual prod smoke).
- [ ] Backend network binding decision made and documented.

**Functionality**
- [ ] Council run returns 5 stages + evaluation; final response has the mandatory sections.
- [ ] RAG ingest→search→grounding works on each supported file type; deprecated/archived
      excluded; low-trust warnings shown.
- [ ] Decision → approve → gated execute; task from decision; critical confirmation phrase.
- [ ] Workflow allow-list + approval gate; tool registry enforcement; honest run status.
- [ ] Metrics overview counts reconcile with DB.

**Ops**
- [ ] Backup excludes the real `.env`; restore round-trip restores DB + data;
      `last_backup` updates.
- [ ] `/api/hardware/status` returns the documented shape; CPU-fallback behavior confirmed
      on the real RX 6600 XT.
- [ ] Required models present (or missing-model hints correct); no auto-pull, no cloud
      fallback.

**Docs & migrations**
- [ ] 12 docs in `docs/`; reviewed against code (no drift).
- [ ] Alembic-vs-`create_all` decision made; migration parity confirmed if Alembic.

**Sign-off**
- [ ] Grok final red-team complete; criticals resolved.
- [ ] Gemini final QA complete; drift list resolved.

---

## 7–9. Final review + continuation prompts

Ready-to-paste prompts are provided as separate files for convenience:

- `handoff/GROK_FINAL_REDTEAM_PROMPT.md` — adversarial review after Sprint 9.
- `handoff/GEMINI_FINAL_QA_PROMPT.md` — functional QA after Sprint 9.
- `handoff/MAIN_CLAUDE_CONTINUATION_PROMPT.md` — concise prompt to drive this Sprint 9
  finalization in a fresh main-Claude session.

Run Grok and Gemini **after** the code/test/docs work and the gates in §5–§6 are green.
