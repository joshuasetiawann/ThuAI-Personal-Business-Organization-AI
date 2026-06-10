# Backend Architecture

A FastAPI application (`backend/main.py`, version `2.0.0`) over async SQLAlchemy 2.0. All
state and inference are local. The app exposes interactive docs at `/api/docs`.

## Layers

```
api/routes/*   HTTP endpoints, auth/permission deps, structured errors
   │
services/*     business logic (council, knowledge/RAG, decisions, tasks,
   │           approvals, workflows, files, hardware, metrics, bootstrap)
   │
agents/*       local Ollama client, council orchestration, model router, prompts
   │
core/*         local-only guard, security (JWT/bcrypt/RBAC), permissions, audit, errors
   │
db/*           async engine/session (base.py) + ORM models (models.py)
tools/*        registered-tool registry + runtime enforcement
adapters/optional/  quarantined legacy Supabase adapter (disabled, gated)
```

## Local stack (`docker-compose.yml`)

`ollama`, `postgres` (15-alpine), `redis` (7-alpine), `n8n`, and `backend`. ollama,
postgres, redis, and n8n bind to `127.0.0.1`. Secrets come from `.env` (never committed);
compose refuses to start without `POSTGRES_PASSWORD` and `N8N_BASIC_AUTH_PASSWORD`.

## Database portability

`db/base.py` defines DB-agnostic types so the *same* models run on PostgreSQL (native
`UUID` + `JSONB`) in production and on SQLite (`aiosqlite`) for tests:

- `GUID` — PG `UUID` else `CHAR(36)`.
- `JSONType` — `JSONB` on Postgres, generic `JSON` elsewhere.
- `TimestampMixin` — `created_at` / `updated_at`.

The session factory is lazy: `get_db()` yields `None` if the DB is unreachable, and
routes are written to handle that (`503 DB_OFFLINE`). JSON columns use the `*_json` /
`metadata_json` convention (never the reserved `metadata`).

## Domain models (single source of truth: `db/models.py`)

Identity/RBAC (`users`, `roles`, `user_roles`); conversations (`conversations`,
`messages`); council (`agent_runs`, `agent_messages`, `prompt_versions`, `evaluations`);
knowledge (`documents`, `document_chunks`, `datasets`); governance (`decisions`, `tasks`,
`approval_requests`, `workflow_runs`); observability/audit (`system_metrics`,
`model_usage_logs`, `error_logs`, `audit_logs`); plus `clients`, `projects`, `reports`,
`artifacts`, `risks`, `notifications`, `sandbox_runs`.

## Startup sequence (`main.py`)

1. `startup_safety_check()` — in **production** a non-empty problem list refuses start
   (default secret, default DB/n8n password, wildcard CORS, enabled external adapter, or
   `LOCAL_ONLY_MODE` off). In development, problems print as warnings.
2. `init_db(create_all=True)` — initialise engine/session; create tables if reachable.
3. `run_bootstrap()` — idempotent seeding of roles, default prompts, and the founder
   user (from env only).

> Note: an Alembic baseline exists (`alembic/versions/0001_initial.py`), but startup uses
> `create_all`. Pick one as authoritative for production migrations (see readiness
> checklist).

## Error handling

`core/errors.py` defines a consistent contract: `{error, code, message, detail,
suggested_action}`. The generic exception handler persists an `ErrorLog` and returns
`INTERNAL_ERROR` **without** leaking the stack trace. Helpers exist for
`OLLAMA_OFFLINE` and `MODEL_NOT_FOUND`.
