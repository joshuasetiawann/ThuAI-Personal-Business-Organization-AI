# What Main Claude Should Implement in Sprint 9

Parallel-support output only — this session wrote **no** backend code. The items below
are for the main (code-executing) Claude. Ordered by priority.

## 1. Land the docs
- [ ] Copy the 12 drafts from `thunity-sprint9-prep/docs/` into the repo's `docs/`
  (currently empty). Review each against the code and adjust if anything drifted.

## 2. Close test gaps (`reviews/MISSING_TESTS_CHECKLIST.md`)
- [ ] Backup `.env`-exclusion test (highest value).
- [ ] Hardware endpoint: auth + structured-shape tests.
- [ ] `/api/health/local-only` compliance test; `assert_local_only()` unit test;
  `check-local-only.py` invoked as a test (assert exit 0).
- [ ] Audit no-`PUT`/`PATCH` assertions.
- [ ] Backend import + route-mount smoke test.

## 3. Run and record the gates (do not assume — execute)
- [ ] `cd backend && pytest -q` → record pass/fail counts.
- [ ] `python scripts/check-local-only.py` → confirm exit 0 / "PASS".
- [ ] Capture both outputs into the readiness review.

## 4. Backup / restore final check
- [ ] Run `bash scripts/backup-local.sh`; extract the archive; confirm it contains
  `.env.example` and **no** `.env`.
- [ ] Run `bash scripts/restore-local.sh <archive>` into a clean local stack; confirm DB
  + data return; confirm `last_backup` updates in `/api/metrics/overview`.

## 5. Hardware awareness final check (on the real machine)
- [ ] Hit `GET /api/hardware/status` with a token; confirm CPU/RAM/disk/GPU fields and
  the `ollama.missing_models` list.
- [ ] With a real Ollama, confirm whether `gpu_acceleration_confirmed` is true on the RX
  6600 XT, or whether the CPU-fallback warning is correctly shown.

## 6. Hardening observations to decide on (not bugs — judgment calls)
- [ ] **Network binding:** `docker-compose.yml` publishes the backend on `0.0.0.0:8000`
  while ollama/postgres/redis/n8n bind `127.0.0.1`. Consider `127.0.0.1:8000` (and/or
  `BACKEND_HOST=127.0.0.1`) for a pure single-machine posture.
- [ ] **Migrations vs `create_all`:** startup uses `Base.metadata.create_all`, but
  `alembic/versions/0001_initial.py` exists. Choose the production-authoritative path;
  if Alembic, wire `alembic upgrade head` and confirm parity with `db/models.py`.
- [ ] **n8n outbound:** the allow-list governs which workflows the backend triggers, but
  n8n workflow *contents* can call external URLs. Document/operationally constrain this.

## Guardrails for this sprint
- Do not start Shot 3 (frontend / Founder Command Center).
- Do not add any cloud/external AI fallback.
- Keep new tests local-only and Ollama-free (mock Ollama, SQLite, `N8N_ENABLED=false`).
- Keep `not_implemented` / `skipped` / `failed` honest — never fake success.
