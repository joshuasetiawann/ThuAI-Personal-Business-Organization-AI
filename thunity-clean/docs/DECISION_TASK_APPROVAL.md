# Decisions, Tasks & Approvals

The governance layer turns AI output into accountable, traceable action. The AI
proposes; humans approve high-risk action.

## Decision ledger (`services/decision_service.py`)

Statuses: `draft → pending_approval → approved | rejected | revised → executed →
archived`. Each decision carries `risk_level` and traceability fields: `conversation_id`,
`agent_run_id`, `evidence_json` (sources + evaluation), `created_by`, `approved_by`. A
council run can write its final output straight into the ledger
(`save_as_decision=true`), preserving the link back to the reasoning that produced it.

Endpoints: `POST /api/decisions`, `GET`, `GET /{id}`, `PATCH /{id}`,
`POST /{id}/approve`, `POST /{id}/reject`, `POST /{id}/execute`.

**Gated execution.** `POST /api/decisions/{id}/execute` without an `approval_id` for a
high-risk decision returns `202` with `approval_required: true` and an `approval_id`;
only after that approval is resolved does a second `execute?approval_id=...` move the
decision to `executed`.

## Tasks / mission board (`services/task_service.py`)

Statuses: `backlog → todo → doing → blocked → review → done | cancelled`. Tasks can be
created directly or generated from a decision (`create_from_decision` /
`POST /api/tasks/from-decision/{decision_id}`), carrying the source decision id and risk
level forward.

## Approval policy (`services/approval_service.py`)

Risk tiers: `low`, `medium`, `high`, `critical`.

- **Who may resolve** (`can_resolve`): `founder` resolves any tier; `admin` resolves only
  `low`/`medium`; others cannot resolve.
- **Confirmation phrase**: `critical` actions require a typed phrase (default
  `"APPROVE DELETE"`). Approving a critical request without the exact phrase returns
  `400`.
- **The AI never self-approves** a risky action — approval requests are resolved by a
  human with sufficient role.

Endpoints: `POST /api/approvals`, `GET`, `GET /pending`, `POST /{id}/approve`,
`POST /{id}/reject`.

## The chain

Council output → **decision** (with evidence + evaluation) → **task(s)** → optionally a
governed **workflow** (see `WORKFLOW_TOOL_GOVERNANCE.md`), with an **approval** gate
wherever risk is high/critical. Every step is audited.

## Tests

`test_decision_task_approval.py` covers: unauth `401`; create/approve/reject a decision;
task create + from-decision; approval create/resolve; critical-confirmation-phrase
enforcement; and high-risk decision execution being gated behind an approval.
