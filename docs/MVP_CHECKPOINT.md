# Thunity Local AI Company OS — MVP Checkpoint

Local-first AI operating system. Your company brain stays on your machine.

## 1. Demo-ready now
- **Dashboard / Founder Daily Briefing** — prioritized "what needs your attention" (approvals, failed runs, untrusted docs, no-backup, open tasks) + local-only / GPU / backup status, from live backend data.
- **Knowledge Vault** — upload/ingest documents (txt/md/csv/json/xlsx/pdf), parsed + embedded locally; semantic **search** with trust/relevance/grounding.
- **AI Council** — 4 local agents + evaluator, 6 sequential stages; optional **Use Knowledge Base** (default off); synthesis + evaluation + transcript; elapsed timer; honest failure states.
- **Source trust visibility** — grounded sources shown with trust badge, status, relevance, page/sheet, warnings, preview (non-authoritative note).
- **Conversations** — read-only list + persisted message thread per run.
- **Draft Decisions** — save a completed Council result as a draft decision (with confirmation).
- **Backlog Tasks** — create one backlog task from a completed Council result (with confirmation).
- **Approval Queue** — view pending/history; founder/admin **resolve** (approve/reject); critical requires confirmation phrase; resolve updates status only.
- **Decision "Mark as Executed"** — ledger status transition + audit (high/critical needs an approved approval_id); not a workflow/tool run.
- **Workflows Lite** — allow-listed workflows; trigger low/medium only; high/critical approval-gated/disabled; honest run statuses.
- **Tools Registry** — display-only registry (name, risk, permission, audit, input schema).
- **Audit Trail & System Observatory** — append-only audit; services, hardware, models, workflow runs, tools.

## 2. Intentionally disabled (by design, this checkpoint)
- Full **tool execution** (handlers inert → `not_implemented`; UI is registry-view only).
- **High-risk workflow trigger** from the UI (approval-gated; Lite shows it disabled).
- Document **verify / deprecate / reindex / delete** governance mutations.
- **Backup / restore** from the UI (CLI scripts exist server-side).
- **Arbitrary payloads / free-form workflow names / free-form tool args.**
- **Auto-execution / auto-approval** — nothing risky happens without an explicit founder click.

## 3. Safety posture
- **Local-only**: Ollama for reasoning + embeddings; no cloud/external AI in the core path; `LOCAL_ONLY_MODE` enforced and audited.
- **No fake success**: skipped/failed/offline/not_implemented are shown verbatim; success requires a real 200 with the expected status.
- **Approval-gated high-risk**: high/critical decisions, workflows, and tools require an approved approval; critical needs a confirmation phrase.
- **Read-only where appropriate**; **explicit clicks only** (confirmation steps on draft/task/execute/critical-reject).
- **Auditable**: sensitive actions (logins, ingest, council runs, approvals, decision/workflow events, tool block/call, local-only blocks) recorded append-only.
- **401** clears session → login; **403/404/409/503/NETWORK** surfaced honestly.

## 4. Demo flow (for Joshua)
1. **Log in** as founder → land on **Dashboard** (Founder Daily Briefing + local-only badge).
2. **Knowledge Vault** → upload a doc (indexed + untrusted) → **Search** it (trust/grounding).
3. **AI Council** (KB off) → ask a question → watch 6 stages → synthesis + evaluation + transcript *(2–4 min local)*.
4. **AI Council** (KB on) → re-ask → show **Source grounding** with trust badges.
5. **Conversations** → open the run → read persisted transcript.
6. From the result: **Save as Draft Decision** → open **Decisions**; **Create Task** → open **Mission Board**.
7. **Approvals** → show pending/critical queue + founder resolve + confirmation phrase (status only).
8. **Decisions** → **Mark as Executed** (low/medium direct; high/critical shows approval flow).
9. **Workflows** (allow-list, low/medium trigger; high-risk disabled) + **Tools Registry** (display-only).
10. **Audit Trail** / **Observatory** → show append-only record + local infra/model status.

Pre-demo: clear `frontend/dist`, ensure Ollama models are pulled (Observatory → Local Models shows none missing). Full run sheet: `docs/DEMO_TODAY.md`.

## 5. Next recommended sprint (after review)
Prefer **polish before new power**:
- **Observability / deep-link polish** — run→conversation deep links (needs a small backend field: include `conversation_id` in the `agent_run` audit metadata or add `GET /api/agents/runs/{id}`); approval→decision/workflow hand-off so an approved `approval_id` carries across pages instead of manual copy; auto-refresh on key pages.
- **W13 (next capability)** only **after** Grok/Gemini review of this checkpoint — and only with the same safety posture (approval-gated, no fake success, explicit clicks, audited).

> Known environment note: build into the default `frontend/dist` can hit an OS-locked-`dist` `EPERM` in the sandbox only; on a normal machine `npm run build` works after removing `frontend/dist`.
