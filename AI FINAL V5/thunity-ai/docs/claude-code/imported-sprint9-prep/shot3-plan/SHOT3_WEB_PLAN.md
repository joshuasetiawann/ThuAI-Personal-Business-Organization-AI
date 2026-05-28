# Shot 3 — Founder Command Center: Planning Pack

Planning only. No code, no backend edits. Assumes Sprint 9 is **not yet** passed — this is
prep so the team moves fast once the backend gate is green. Endpoints below are the real
ones in `backend/api/routes/*`; the `require_permission` decorators there are the
authoritative permission source. Roles: founder (all), admin, operator, analyst, viewer.

---

## 1. Final Backend Review Pack

**Grok final red-team (short):** Red-team the Thunity Local AI Company OS backend before
its frontend. Promise: company brain stays local (Ollama-only, local Postgres/Redis/n8n,
no cloud AI, bcrypt/JWT+RBAC, approval gates, allow-listed workflows, registered tools,
append-only audit). Try to: escape local-only (config flips, n8n outbound, any external
call — confirm prod startup refuses + attempts audited); bypass auth/RBAC + forge JWTs +
cross-user access; bypass governance (high-risk decision without approval, critical
without the `APPROVE DELETE` phrase, unregistered tool, non-allow-listed workflow); leak
secrets (`/api/settings`, errors, audit, backups excluding real `.env`); path-traversal +
malicious uploads; prompt-inject via knowledge docs; assess `0.0.0.0:8000` LAN exposure;
tamper audit; DoS via the 14B model. Return severity×likelihood + repros + local-only
fixes; mark documented limits (gfx1032 GPU, linear-cosine search, sandbox no-exec) as
residual risk. Fuller version: `handoff/GROK_FINAL_REDTEAM_PROMPT.md`.

**Gemini final QA (short):** Functional QA of the backend (+`docs/`). Verify pass/fail:
`docker compose up -d` + idempotent bootstrap; gates (`pytest -q` green w/ counts,
`check-local-only.py` exit 0); RBAC matrix; council returns 5 stages + evaluation with the
mandatory synthesizer sections + persisted memory + `failed` on Ollama-offline; RAG
ingest→search→grounding per file type with trust/lifecycle filtering; decision→approve→
gated execute + critical phrase; workflow allow-list + approval gate; tool registry honest
`not_implemented`; metrics reconcile with DB; backup→restore excludes real `.env`;
`/api/hardware/status` shape. Cross-check every `docs/*.md` vs code; end "ready for Shot 3?
yes/no + blockers". Fuller version: `handoff/GEMINI_FINAL_QA_PROMPT.md`.

**Final gate (all must hold):** `import main` clean · `check-local-only.py` PASS ·
`pytest backend/tests` green or exact blockers reported · `docs/` populated (12) ·
backup/restore docs + scripts verified · `/api/hardware/status` works or limitation
documented · no cloud fallback · sensitive routes 401 unauthenticated · workflow/tool
governance enforced. Full list: `handoff/FINAL_HANDOFF.md` §4.

---

## 2. Founder Command Center — Screen Map

Format per screen: **Purpose · Action · Endpoints · Shows · Empty · Error · Permission ·
Risk/approval.**

**1. Login** — Purpose: authenticate, get JWT. · Action: submit username+password. ·
Endpoints: `POST /api/auth/login`, then `GET /api/auth/me`. · Shows: form, role/permissions
after login. · Empty: blank form. · Error: 401 → "Invalid username or password"; 503
`DB_OFFLINE`. · Permission: public. · Risk: lockout/failed_auth is audited; never store the
password, only the token in memory.

**2. Founder Dashboard** — Purpose: at-a-glance health + activity. · Action: read; drill
into alerts. · Endpoints: `GET /api/metrics/overview`, `GET /api/health/local-only`,
`GET /api/hardware/status`. · Shows: agent runs today, avg latency, failed runs, error
count, pending approvals, decisions/tasks counts, docs unverified, `local_only_status`,
`last_backup`, hardware warning. · Empty: "No activity yet." · Error: per-widget "data
unavailable" (never zeros-as-real). · Permission: `READ_DASHBOARD` (all roles). · Risk:
show local-only badge + Ollama/GPU warnings prominently.

**3. AI Council** — Purpose: run the 4-agent council. · Action: submit a question;
optionally use knowledge base / save as decision / create tasks. · Endpoints:
`POST /api/agents/council` (`message`, `use_knowledge_base?`, `top_k?`, `save_as_decision?`,
`create_tasks_from_output?`, `allow_deep_reasoning?`); `GET /api/agents/health`;
`POST /api/agents/single`. · Shows: 5 stage outputs, final synthesizer sections,
evaluation rubric, grounding/sources, latency. · Empty: prompt input only. · Error: Ollama
offline → stage `failed` shown explicitly; `EMPTY_MESSAGE` 400. · Permission: `RUN_ANALYSIS`
(analyst/admin/founder). · Risk: `allow_deep_reasoning` warns (heavy 14B); save-as-decision
creates a draft (not auto-approved).

**4. Conversations** — Purpose: persistent chat memory. · Action: open/list, add messages.
· Endpoints: `GET/POST /api/conversations`, `GET /api/conversations/{id}`,
`GET/POST /api/conversations/{id}/messages`. · Shows: conversation list, message thread
(user/assistant/agent). · Empty: "No conversations yet." · Error: 403 cross-user (founder
exempt); 404 missing. · Permission: authenticated; ownership enforced. · Risk: none direct.

**5. Knowledge Vault** — Purpose: local RAG corpus. · Action: ingest, search, verify,
deprecate, reindex, delete. · Endpoints: `POST /api/knowledge/ingest`,
`POST /api/knowledge/search`, `GET /api/knowledge/documents[/{id}]`,
`POST .../verify|deprecate|reindex`, `DELETE .../{id}`. · Shows: documents (status, trust,
sensitivity, chunk_count), search results with `relevance_score`+trust warnings, "Sources
used:" grounding. · Empty: "No documents — ingest a file." · Error: unsupported type;
oversized (`MAX_UPLOAD_MB`); traversal blocked. · Permission: `READ_KNOWLEDGE` to read;
`UPLOAD_FILES`/`MANAGE_DOCUMENTS` to ingest/manage; `DELETE_DOCUMENT` to delete. · Risk:
low-trust/`untrusted` default flagged; deprecated/archived excluded from retrieval.

**6. Decision Ledger** — Purpose: traceable decisions. · Action: create draft, view,
approve/reject, execute. · Endpoints: `GET/POST /api/decisions`, `GET/PATCH
/api/decisions/{id}`, `POST .../approve|reject|execute`. · Shows: status
(draft→…→executed), risk_level, linked conversation/agent_run, evidence/sources, approver.
· Empty: "No decisions yet." · Error: invalid status. · Permission: `CREATE_DRAFT_DECISION`
to draft; `APPROVE_DECISION` to approve (admin/founder); `READ_APPROVED_DECISIONS` to view
approved. · Risk: **high-risk execute is gated** → `202 approval_required` + `approval_id`;
UI must route to Approval Center, not fake success.

**7. Mission / Task Board** — Purpose: execution tracking. · Action: create, update
status, create-from-decision. · Endpoints: `GET/POST /api/tasks`, `GET/PATCH
/api/tasks/{id}`, `POST /api/tasks/from-decision/{decision_id}`. · Shows: tasks by status
(backlog→done), priority, owner, source decision, risk. · Empty: "No tasks." · Error: 403
by permission. · Permission: `CREATE_TASKS`/`MANAGE_TASKS`. · Risk: carries decision risk
forward.

**8. Approval Center** — Purpose: human gate for risky actions. · Action: review pending,
approve/reject (critical needs phrase). · Endpoints: `GET /api/approvals`,
`GET /api/approvals/pending`, `POST /api/approvals`, `POST .../{id}/approve|reject`. ·
Shows: pending requests, action, risk_level, requester, required confirmation phrase. ·
Empty: "No pending approvals." · Error: missing/wrong phrase → 400; insufficient role →
403. · Permission: founder resolves any; admin resolves low/medium only. · Risk: **core
governance screen** — critical requires typed `APPROVE DELETE`; AI never self-approves;
founder is final.

**9. Workflow Center** — Purpose: governed n8n automation. · Action: view allow-list,
trigger, inspect runs. · Endpoints: `GET /api/workflows/allowed`,
`POST /api/workflows/trigger`, `GET /api/workflows/runs[/{id}]`. · Shows: 6 allow-listed
workflows + risk; run status (`skipped`/`failed`/`completed`), logs, source ids. · Empty:
"No runs yet." · Error: non-allow-listed → 403 `WORKFLOW_NOT_ALLOWED` (audited); n8n off →
status `skipped`. · Permission: `RUN_APPROVED_WORKFLOW`; `EXECUTE_WORKFLOW` for high-risk. ·
Risk: high (`purge_knowledge_base`) → `202 approval_required`; show honest status, never
fake "done".

**10. Tool Registry** — Purpose: visibility + governed execution of registered tools. ·
Action: list tools, execute (where permitted). · Endpoints: `GET /api/tools`,
`POST /api/tools/execute`. · Shows: tool name, risk, required permission, audited flag. ·
Empty: n/a (registry static). · Error: unregistered → 403 `TOOL_NOT_REGISTERED`; no perm →
403 `TOOL_FORBIDDEN`; no handler → `not_implemented` shown literally. · Permission:
per-tool. · Risk: high-risk tool → `approval_required`; no free-form calls.

**11. System Observatory** — Purpose: real observability. · Action: read metrics. ·
Endpoints: `GET /api/metrics/{system,overview,models,agents,knowledge,workflows}`,
`GET /api/models/{local,health}`. · Shows: latency/usage per model+agent, doc stats,
workflow aggregates, missing-model pull hints, heavy-model warnings. · Empty: "No data
yet." · Error: data unavailable. · Permission: `READ_DASHBOARD`; model views authenticated.
· Risk: never present placeholder numbers as real.

**12. Audit Trail** — Purpose: accountability. · Action: browse/filter (read-only). ·
Endpoints: `GET /api/audit`, `GET /api/audit/{id}`. · Shows: actor, role, action, entity,
timestamp, scrubbed metadata. · Empty: "No audit entries." · Error: 403 without
`VIEW_LOGS`. · Permission: `VIEW_LOGS` (admin/founder). · Risk: **read-only** — no
edit/delete control in UI; reflects append-only backend.

**13. Settings / Governance** — Purpose: posture snapshot (read-only). · Action: view
config + compliance. · Endpoints: `GET /api/settings`; user mgmt via
`POST /api/auth/users`. · Shows: app_env, `local_only_mode`, `compliance_status`,
execution mode, model map, hardware profile, `external_ai_providers: "blocked"`. · Empty:
n/a. · Error: 403. · Permission: authenticated to view; `MANAGE_USERS` (founder) to create
users. · Risk: never render secrets (backend already redacts).

---

## 3. Backend → Frontend API Map

Auth = needs Bearer token. Risk/approval = governance gate the UI must honor.

| Group | Path | Screen | Auth | Request | Response | UI state | Risk/approval |
|------|------|--------|:---:|---------|----------|----------|----------------|
| Auth | POST /api/auth/login | Login | no | username,password | token,role,permissions | store token; route to dashboard | failed_auth audited |
| Auth | GET /api/auth/me | shell | yes | — | user+permissions | gate menu by permissions | — |
| Auth | POST /api/auth/users | Settings | yes | email,password,role | id,email,role | user list | MANAGE_USERS (founder) |
| Health | GET /api/health/local-only | Dashboard | no | — | local_only_mode,ollama,status | local-only badge | surface `error`/`warning` |
| Agents | POST /api/agents/council | AI Council | yes | message,flags | 5 stages,final,evaluation,sources | render stages+grounding | deep=heavy warn; save→draft |
| Agents | GET /api/agents/health | AI Council | yes | — | ollama status,models | offline banner | Ollama offline explicit |
| Conversations | GET/POST /api/conversations[...] | Conversations | yes | title/message | list/thread | thread view | 403 cross-user |
| Knowledge | POST /api/knowledge/ingest | Vault | yes | file,metadata | doc(status,trust,chunks) | add to list | UPLOAD_FILES; size/type limits |
| Knowledge | POST /api/knowledge/search | Vault/Council | yes | query,top_k | results+grounding | results w/ trust warnings | low-trust flagged |
| Knowledge | POST .../{id}/verify\|deprecate\|reindex | Vault | yes | — | updated doc | status change | MANAGE_DOCUMENTS |
| Knowledge | DELETE .../{id} | Vault | yes | — | ok | remove row | DELETE_DOCUMENT |
| Decisions | POST/GET/PATCH /api/decisions[...] | Ledger | yes | title,risk,text | decision(status) | ledger row | CREATE_DRAFT_DECISION |
| Decisions | POST .../{id}/approve\|reject | Ledger/Approvals | yes | — | status | update badge | APPROVE_DECISION |
| Decisions | POST .../{id}/execute | Ledger | yes | approval_id? | 200 or 202 approval_required | route to Approval Center | **high-risk gated** |
| Tasks | GET/POST/PATCH /api/tasks[...] | Task Board | yes | title,status | task | board column | CREATE/MANAGE_TASKS |
| Tasks | POST /api/tasks/from-decision/{id} | Ledger→Board | yes | — | task | new task | carries risk |
| Approvals | GET /api/approvals/pending | Approval Center | yes | — | pending[] | queue | founder/admin |
| Approvals | POST .../{id}/approve | Approval Center | yes | confirmation? | status | resolve | **critical needs phrase** |
| Workflows | GET /api/workflows/allowed | Workflow Center | yes | — | 6 workflows+risk | list | — |
| Workflows | POST /api/workflows/trigger | Workflow Center | yes | workflow_name,payload | run or 202 | run row | high→approval; non-listed 403 |
| Workflows | GET /api/workflows/runs[/{id}] | Workflow Center | yes | — | runs(status,logs) | honest status | skipped if n8n off |
| Tools | GET /api/tools | Tool Registry | yes | — | tools+risk+perm | list | — |
| Tools | POST /api/tools/execute | Tool Registry | yes | name,args,approval_id? | ok/not_implemented/approval | literal status | high→approval; unregistered 403 |
| Metrics | GET /api/metrics/overview | Dashboard/Observatory | yes | — | real counts | widgets | real-or-"no data" |
| Metrics | GET /api/metrics/{models,agents,knowledge,workflows} | Observatory | yes | — | aggregates | charts | — |
| Models | GET /api/models/health | Observatory | yes | — | installed,missing,heavy | pull hints | no auto-pull |
| Hardware | GET /api/hardware/status | Dashboard | yes | — | cpu,ram,disk,gpu,ollama | gauges+warning | CPU-fallback explicit |
| Audit | GET /api/audit[/{id}] | Audit Trail | yes | filter | entries | read-only table | VIEW_LOGS; no mutate |
| Settings | GET /api/settings | Settings | yes | — | posture (redacted) | read-only | secrets never shown |

---

## 4. Shot 3 Web Micro-Sprint Plan

Each week: wire to **real** endpoints, ship empty+error+offline states, no dummy data.

- **W1 — Auth shell + layout.** Login → token handling → `GET /me` → permission-gated nav.
  App frame for the 13 screens. Persistent local-only badge (`/health/local-only`). Exit:
  login works against the real backend; routes guarded by role.
- **W2 — Dashboard + system status.** `metrics/overview`, `hardware/status`,
  `models/health`. Real widgets with "no data"/"unavailable" states; Ollama/GPU warnings.
  Exit: dashboard reflects live backend, zero placeholders.
- **W3 — Conversations + AI Council UI.** Council request/flags, 5-stage render, evaluation,
  grounding/sources; conversation persistence. Exit: a full council run displays honestly,
  including an Ollama-offline `failed` stage.
- **W4 — Knowledge Vault.** Ingest (type/size limits), search w/ trust warnings + grounding,
  verify/deprecate/reindex/delete. Exit: RAG lifecycle usable end-to-end.
- **W5 — Decisions / Tasks / Approvals.** Ledger lifecycle, gated execute → Approval Center,
  task board, critical confirmation phrase. Exit: high-risk paths always pass through the
  approval gate.
- **W6 — Workflows / Tools / Audit / Observatory.** Allow-list trigger + honest run status,
  tool registry + governed execute, read-only audit, deeper metrics. Exit: governance +
  observability fully surfaced.
- **W7 — Polish + QA + final review.** Accessibility, error consistency, i18n
  (Indonesian/English), perf; run Grok red-team + Gemini QA on the integrated app. Exit:
  frontend review clean; ready to ship.

---

## 5. UI Safety Rules (non-negotiable)

1. **No fake success.** Render backend status literally — `skipped`, `failed`,
   `not_implemented`, `approval_required` are shown as-is; never auto-display "done".
2. **No dummy metrics.** All numbers come from `metrics/*`; if absent, show "no data",
   never placeholders or zeros styled as real.
3. **High-risk shows the gate.** Any `202 approval_required` (decisions execute, high-risk
   workflows/tools) routes the user to Approval Center; critical shows the confirmation-
   phrase field.
4. **Local-only status always visible.** Persistent badge from `/api/health/local-only` +
   `settings.external_ai_providers: "blocked"`; turn red on `warning`/`error`.
5. **Ollama offline is explicit.** Use `agents/health` + `models/health`; banner when
   offline; council stage `failed` shown, never hidden.
6. **Workflow offline/skipped is explicit.** Show `skipped` (n8n disabled) / `failed`
   distinctly from `completed`.
7. **Audit is visible, not editable.** Read-only views only; no edit/delete affordance
   (mirrors append-only backend).
8. **Founder is the final decision-maker.** No UI path auto-approves; approvals are always
   a human action with sufficient role.

Plus: never display secrets; render only what `/api/settings` returns (already redacted).

---

## 6. What Main Claude Should Do After Sprint 9

1. **Only after the §1 gate is green** (import clean, scanner PASS, pytest green/blockers
   reported, docs populated, backup/hardware verified). Do not start Shot 3 before this.
2. **Decide the frontend stack** (open decision — not chosen here). Whatever the choice,
   keep it **fully local**: self-host all assets/fonts (no external CDN), no telemetry,
   talk only to `http://127.0.0.1:8000`. The backend CORS allowlist already includes
   `localhost:3000/8080/8000`, so a dev server on :3000 works out of the box.
3. **Scaffold W1 first** (auth shell + permission-gated layout) wired to the real backend —
   no mock layer that could mask offline/empty states.
4. **Build screens in W1–W7 order**, each backed by real endpoints with empty/error/offline
   states from day one (UI Safety Rules §5).
5. **Surface governance everywhere**: local-only badge, Ollama/n8n status, approval gates,
   read-only audit; founder stays the final approver.
6. **Run the final reviews at W7** using the Grok/Gemini prompts (here or in `handoff/`).
7. **Do not** edit working backend modules to suit the UI; if an endpoint is missing for a
   screen, log it as a backend change request — do not invent client-side data.
