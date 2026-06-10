# Missing Test Checklist (Sprint 9)

Gaps relative to the requested coverage. Each item lists a concrete test to add. None of
these exist in the current suite (verified by reading all six test files). Tests were
**not run** in this review — see `docs/TESTING.md`.

## Backup / restore

- [ ] **Backup scripts exist & are executable** — assert `scripts/backup-local.sh` and
  `scripts/restore-local.sh` exist and have the executable bit.
- [ ] **Backup excludes the real `.env`** — run `backup-local.sh` against a temp `ROOT`
  containing a dummy `.env` and `.env.example`; extract the archive; assert it contains
  `.env.example` and **does not** contain `.env`. *(Highest value — protects secrets.)*
- [ ] **Data excludes `data/backups`** — assert the data tar does not nest prior backups.

## Hardware endpoint

- [ ] **Requires auth** — `GET /api/hardware/status` without a token → `401`. (It is
  **not** in `test_security.py`'s `SENSITIVE_GET` list today.)
- [ ] **Returns structured status** — with founder token → `200` and body contains
  `cpu`, `ram`, `disk`, `gpu`, `gpu_acceleration_confirmed`, and `ollama.missing_models`.

## Local-only guard / audit

- [ ] **`/api/health/local-only` is compliant** — with `LOCAL_ONLY_MODE=true`, assert
  `status == "compliant"`, `external_ai_providers_enabled == false`, and the documented
  keys are present.
- [ ] **`assert_local_only()` raises** — direct unit test that it raises
  `ExternalProviderBlocked` under local-only (complements the existing
  `block_external_call` / Supabase tests).
- [ ] **Scanner passes on the clean repo** — invoke `scripts/check-local-only.py` (e.g.
  via `subprocess`) and assert exit code `0` and "PASS" in output.

## Audit append-only

- [ ] **No mutation routes** — extend the existing no-`DELETE` test to also assert
  `PUT`/`PATCH` on `/api/audit` and `/api/audit/{id}` return `404`/`405`.
- [ ] **Entries persist immutably** — create an auditable action, read it back, confirm
  there is no API path that edits it.

## Docs existence / readiness (optional but useful)

- [ ] **Required docs present** — assert each `docs/*.md` from the Sprint 9 list exists
  and is non-empty (guards against shipping without docs).

## Final backend import / sanity

- [ ] **App import + route mount smoke test** — `import main`; assert all expected router
  prefixes are mounted (`/api/auth`, `/api/agents`, …, `/api/settings`) by inspecting
  `app.routes`.
- [ ] **`required_models()` is local-only** — assert no returned model name contains a
  cloud vendor token (extends the existing model-router check to the required set).

## Suggested file layout

`backend/tests/test_backup_restore.py`, `test_hardware.py`, `test_local_only_health.py`,
`test_smoke_imports.py` (or fold into existing files). Keep them local-only and
Ollama-free like the current suite.
