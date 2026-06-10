# API Overview

Base URL `http://localhost:8000`. Interactive docs at `/api/docs`, ReDoc at
`/api/redoc`. Auth is a Bearer JWT obtained from `POST /api/auth/login`. Most endpoints
require a token; many also require a specific permission (see `SECURITY_BASELINE.md`).
Errors follow the structured contract `{error, code, message, detail, suggested_action}`.

## Endpoints by router

**Health** (`/api/health`) — `GET ""`, `GET /local-only`.

**Auth** (`/api/auth`) — `POST /login`, `GET /me`, `POST /users` (needs `MANAGE_USERS`).

**AI Council** (`/api/agents`) — `POST /council` (needs `RUN_ANALYSIS`),
`POST /single`, `GET /health`.

**Conversations** (`/api/conversations`) — `POST ""`, `GET ""`, `GET /{id}`,
`GET /{id}/messages`, `POST /{id}/messages`. Cross-user access is forbidden; founder may
access all.

**Knowledge** (`/api/knowledge`) — `POST /ingest`, `POST /search`, `GET /documents`,
`GET /documents/{id}`, `POST /documents/{id}/verify`, `POST /documents/{id}/deprecate`,
`POST /documents/{id}/reindex`, `DELETE /documents/{id}`.

**Files** (`/api/files`) — `POST /upload`, `GET /list`, `GET /read`, `DELETE ""`.

**Datasets** (`/api/datasets`) — `POST /import`, `GET ""`, `GET /{id}`,
`GET /{id}/preview`, `POST /{id}/archive`.

**Decisions** (`/api/decisions`) — `POST ""`, `GET ""`, `GET /{id}`, `PATCH /{id}`,
`POST /{id}/approve`, `POST /{id}/reject`, `POST /{id}/execute`.

**Tasks** (`/api/tasks`) — `POST ""`, `GET ""`, `GET /{id}`, `PATCH /{id}`,
`POST /from-decision/{decision_id}`.

**Approvals** (`/api/approvals`) — `POST ""`, `GET ""`, `GET /pending`,
`POST /{id}/approve`, `POST /{id}/reject`.

**Workflows** (`/api/workflows`) — `GET /allowed`, `POST /trigger`, `GET /runs`,
`GET /runs/{id}`.

**Tools** (`/api/tools`) — `GET ""`, `POST /execute`.

**Models** (`/api/models`) — `GET /local`, `GET /health` (missing-model pull hints).

**Metrics** (`/api/metrics`) — `GET /system`, `GET /overview`, `GET /models`,
`GET /agents`, `GET /knowledge`, `GET /workflows`.

**Hardware** (`/api/hardware`) — `GET /status` (auth required).

**Audit** (`/api/audit`) — `GET ""` (needs `VIEW_LOGS`), `GET /{id}`. Read-only; there is
no delete/update route.

**Sandbox** (`/api/sandbox`) — `POST ""`, `GET ""` (intent/log registry only — see
`WORKFLOW_TOOL_GOVERNANCE.md`).

**Settings** (`/api/settings`) — `GET ""` (read-only snapshot; secrets redacted).

**Root** — `GET /` returns app name + `local_only_mode`.

## Notes

- Sensitive GET endpoints return `401` without a valid token.
- Many write/governance endpoints return `202` with `approval_required: true` when a
  high/critical-risk action needs approval first.
- This is the **Shot 2 backend**; there is no frontend in this repo.

## Shot 3 UI integration notes

- **Long-running AI Council.** `POST /api/agents/council` runs 6 sequential 7B/8B stages
  and can take **2–4 minutes** on local hardware (longer on CPU fallback). The UI must
  show progress and tolerate long requests; a future polling/job API may replace the
  synchronous call.
- **Handle `202 approval_required` globally.** High/critical actions (decision execute,
  workflow trigger, high-risk tools) return `202 {approval_required, approval_id, risk_level}`.
  The UI must detect this shape everywhere and route the user into the approval flow.
- **Bounded lists.** List endpoints accept `limit` (default 100, max 500) and `offset`.
  The UI should paginate rather than assume full result sets.
- **No fake success.** Workflow/tool responses may be `skipped`/`failed`/`not_implemented`;
  render the real state — never show these as success.
