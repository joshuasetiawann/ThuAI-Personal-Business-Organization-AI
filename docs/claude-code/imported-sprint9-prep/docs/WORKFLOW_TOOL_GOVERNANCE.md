# Workflow & Tool Governance

Automation is allow-listed, permissioned, risk-gated, and fully audited. Agents cannot
invent capabilities; n8n is local automation, never a cloud brain.

## Tool registry (`tools/registry.py`, `tools/executor.py`)

Agents and automation may only run **registered** tools. Each tool declares
`risk_level`, `required_permission`, and whether it is `audit`ed. Registered tools
include `search_knowledge_base`, `read_document`, `create_decision_draft`, `create_task`,
`request_approval`, `trigger_allowed_workflow`, `get_system_metrics`, `create_report`.

`execute_tool()` enforces, in order:

1. **Unregistered → blocked** (`403 TOOL_NOT_REGISTERED`) and audited (`tool_blocked`).
2. **Missing permission → blocked** (`403 TOOL_FORBIDDEN`) and audited.
3. **High/critical risk → approval gate**: creates an approval request and returns
   `approval_required: true` instead of running.
4. **Audited** (`tool_called`) when configured.
5. **No bound handler → `not_implemented`** — honest, never a fake success. Handlers are
   bound in `HANDLERS` as the system grows.

There is **no free-form function calling**. `GET /api/tools` lists tool metadata;
`POST /api/tools/execute` runs one under the caller's permissions.

## Workflow governance (`services/workflow_service.py`)

Only allow-listed n8n workflows may run. Current allow-list and risk:

| Workflow | Risk |
|----------|------|
| `generate_local_report` | low |
| `summarize_uploaded_document` | low |
| `create_daily_brief` | low |
| `export_decision_to_markdown` | medium |
| `ingest_client_data_csv` | medium |
| `purge_knowledge_base` | high |

- **Arbitrary names are rejected** and the attempt is audited (`workflow_blocked`).
- **High/critical risk requires approval** before running (`needs_approval`).
- **Every run is persisted** (`workflow_runs`) with `source_decision_id` /
  `source_task_id` traceability. Status is honest: `skipped` (n8n disabled), `failed`, or
  `completed` — never fake success.
- If `N8N_ENABLED=false`, a trigger is recorded as `skipped`, not executed.

## Sandbox (current limitation)

`services/sandbox_service.py` is a **basic registry** that records sandbox-run
intent/logs only. It does **not** execute arbitrary code yet. The documented policy for a
future executor is: no network access, dedicated working dir under `SANDBOX_DIR`, hard
timeout, read-only access to selected inputs, captured logs + artifacts. This is stated
as a limitation, not implied to be more than it is.

## Tests

`test_workflow_tool_observability.py` covers: workflow auth; allow-list listing;
arbitrary-workflow block + audit; high-risk approval gate; source-id persistence and
non-fake status; tool metadata; unregistered-tool block; called/blocked auditing;
high-risk-tool approval; and tool permission enforcement (viewer forbidden).
