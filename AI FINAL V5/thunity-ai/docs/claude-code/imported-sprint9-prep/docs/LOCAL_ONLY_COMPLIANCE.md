# Local-Only Compliance

**Guarantee:** under `LOCAL_ONLY_MODE=true` (the default), no code path reaches an
external AI or cloud provider. There is no cloud fallback. The company brain — models,
embeddings, database, vector store, automation — stays on the founder's machine.

## How it is enforced

**No configuration surface for cloud.** `config.py` has no field for any external AI /
cloud provider key. The only remote-capable code is a quarantined legacy adapter (see
below).

**Hard block at the boundary** (`core/local_only.py`):

- `assert_local_only(provider)` raises `ExternalProviderBlocked` whenever
  `LOCAL_ONLY_MODE` is true.
- `block_external_call(db, actor, provider)` audits the attempt (writes
  `local_only_violation_attempt` and `external_provider_blocked` audit rows) **before**
  raising. It never weakens blocking, even if auditing fails.
- `external_ai_providers_enabled()` returns `True` only if local-only is OFF *and* an
  optional adapter is enabled — otherwise always `False`.
- `compliance_status()` → `compliant` (local-only on, no external) | `warning`
  (local-only off but adapters off) | `error` (local-only off).

**Quarantined optional adapter.** `adapters/optional/supabase_sync.py` is **not imported
by any core path**. Every method calls the local-only guard first, so under default
settings any call raises and is audited. It exists only so prior work is not lost.

## Runtime visibility

`GET /api/health/local-only` reports `local_only_mode`, `ollama_status`,
`external_ai_providers_enabled`, `database`, `vector_store`
(`local_embedding_store (postgres)`), `n8n`, and overall `status`
(`compliant`/`warning`/`error`). `GET /api/settings` reports
`external_ai_providers: "blocked"`. The metrics overview exposes `local_only_blocks`
(count of blocked external attempts) and `local_only_status`.

## Static scanner

`scripts/check-local-only.py` scans `backend/`, `scripts/`, `docker-compose.yml`, and
`.env.example`. It categorizes hits:

- **forbidden active dependency** (e.g. `import openai`, `OPENAI_API_KEY`,
  `api.openai.com`, `.supabase.co`, `create_client(`) in the core path → **exit 1
  (FAIL)**.
- **optional disabled adapter** (`adapters/optional/`) → allowed.
- **documentation mention** (`.md`/`.txt`) and **safe test string** (`tests/`) → allowed.

Run it as part of release: `python scripts/check-local-only.py`.

## Limitations (honest)

- n8n is local automation but is a general tool; an operator could author an n8n
  workflow that itself calls an external URL. The allow-list (`WORKFLOW_TOOL_GOVERNANCE.md`)
  constrains *which* workflows the backend may trigger, but the contents of n8n
  workflows are governed operationally, not by the local-only guard.
- The backend container is published on `0.0.0.0:8000` in `docker-compose.yml` (unlike
  ollama/postgres/redis/n8n, which bind to `127.0.0.1`). "Local-only" refers to data/AI
  sovereignty, not network exposure — see `SECURITY_BASELINE.md` for the recommended
  127.0.0.1 binding.

## Tests

`test_workflow_tool_observability.py::test_local_only_violation_is_audited` and
`::test_supabase_adapter_blocks_and_audits` prove the guard raises and audits. See the
missing-tests checklist for the `/api/health/local-only` and scanner coverage to add.
