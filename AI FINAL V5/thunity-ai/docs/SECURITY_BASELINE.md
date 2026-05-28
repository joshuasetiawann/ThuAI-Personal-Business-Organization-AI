# Security Baseline

Local-first does not mean unprotected. The backend enforces authentication, role-based
authorization, secret hygiene, and safe file handling.

## Authentication

- **Passwords** are hashed with bcrypt via passlib (`core/security.py`). Plaintext is
  never stored.
- **Tokens** are JWTs (`HS256`, `JWT_EXPIRE_MINUTES=1440` default) signed with
  `SECRET_KEY`. `get_current_user` validates the token and loads an active user from the
  DB on every request.
- **No hardcoded credentials.** There is no `admin/admin123`. The first founder is
  bootstrapped only from `FOUNDER_EMAIL` / `FOUNDER_PASSWORD` env vars. Failed logins are
  audited (`failed_auth`).

## Authorization (RBAC)

Roles (`core/permissions.py`): `founder` (all), `admin`, `operator`, `analyst`,
`viewer`. Permissions are a fixed enum mapped per role; `users.role` is authoritative.
Routes guard with `require_role(...)` or `require_permission(Perm.X)`. `founder` bypasses
to all permissions. Representative grants:

- `admin` — manage documents/tasks/users, run analysis, view logs, create + approve
  decisions, run approved workflows.
- `operator` — upload files, create tasks, run approved workflows, read.
- `analyst` — run analysis, create draft decisions, read.
- `viewer` — read dashboard + approved decisions.

## Secret hygiene

- `GET /api/settings` returns a snapshot with `external_ai_providers: "blocked"` and
  **never** exposes `SECRET_KEY`, the DB password, or the n8n password.
- Audit metadata is scrubbed (`core/audit._scrub`): keys containing `password`, `token`,
  `secret`, `jwt`, `secret_key`, or `authorization` are redacted.
- The generic error handler never returns a stack trace to the client.

## Production startup safety

When `APP_ENV=production`, `startup_safety_check()` **refuses to start** if any of these
remain: default/short `SECRET_KEY`, default DB password, default n8n password, wildcard
in `ALLOWED_ORIGINS`, an enabled external adapter, or `LOCAL_ONLY_MODE` off.

## Network and CORS

- CORS uses a strict allowlist from `ALLOWED_ORIGINS`; a wildcard is rejected in
  production and tested against in development.
- **Recommendation:** the `backend` service publishes `8000:8000` (all interfaces) and
  `BACKEND_HOST=0.0.0.0`, while every other service binds `127.0.0.1`. For a pure
  single-machine posture, bind the backend to `127.0.0.1:8000` too. (Tracked in the
  readiness checklist; not changed in this review.)

## File safety

`services/file_service.py` blocks path traversal in both `sanitize_filename` and
`safe_path` (rejects `..`, leading `/` or `~`, backslashes; containment check under
`FILES_DIR`), validates extension against an allow-list, enforces `MAX_UPLOAD_MB`,
assigns a unique storage id (never overwrites), and records a SHA-256 checksum.

## Audit immutability

Audit logs are append-only from the API's perspective: `audit.py` exposes only `GET`
routes — there is no delete or update endpoint.

## Tests

`test_security.py` covers: hardcoded-cred logins fail, sensitive endpoints require a
token, CORS is not wildcard, founder login + bcrypt verification, and token-gated access.
`test_knowledge_file_security.py::test_path_traversal_rejected` covers file safety.
