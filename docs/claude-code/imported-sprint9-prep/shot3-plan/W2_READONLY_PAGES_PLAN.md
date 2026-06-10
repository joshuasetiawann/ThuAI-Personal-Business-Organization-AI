# Shot 3 — W2 Read-Only Pages Plan (for Main Claude)

Planning only. Reviewed the uploaded W1 frontend (React 18 + TS + Vite + react-router v6,
plain CSS, `api/client.ts` with `apiFetch`/`ApiError`/`AuthError`/`ApprovalRequiredError`,
`components/ui.tsx` with `Card/Badge/Stat/Row/ServiceBadge/Loading/ErrorState/Empty/useAsync`,
stub pages via `Placeholder`). **Reuse all of it.** Do not rewrite W1, do not change the
architecture, do not start W3 (AI Council chat).

**W2 = wire 5 read-only pages + enrich 2 existing pages.** Replace these stubs with real
pages: Decisions, Tasks, Approvals, Knowledge Vault, Conversations (list). Enrich:
Observatory (+ workflow runs, + tool registry) and Dashboard (decision/task/approval
cards). Keep council / workflows-trigger / tools-execute / settings as stubs.

### Backend facts that drive the plan (from uploaded routes)
- List endpoints (`decisions`, `tasks`, `approvals`, `knowledge/documents`,
  `conversations`) take `?limit=100&offset=0` (`le=500`) and return
  `{ "<key>": [...], "total": <length of THIS page> }`. **`total` is the page length, not a
  grand total.** → paginate by `offset += limit`; show "Load more" while a page returns
  exactly `limit` rows; never display a fake grand total.
- `GET /api/approvals` → `{approvals:[...]}` and `/pending` → `{pending:[...]}` (no `total`).
- `GET /api/workflows/runs` → `{runs:[...]}` (server-capped at 100, no paging);
  `GET /api/tools` → `{tools:[...]}` (static).
- Viewers get **approved-only** decisions (backend enforces). `GET /api/knowledge/documents`
  requires `READ_KNOWLEDGE` (viewer lacks it → expect 403 — handle honestly).
- `apiFetch` already clears token + throws `AuthError` on 401, and throws
  `ApprovalRequiredError` on `202 approval_required`. W2 has no mutating calls, but keep a
  global catch so any stray 202 is surfaced, never swallowed.

---

## 1. W2 Screen Plan

Per screen: **Purpose · Endpoints · Shows · Empty · Loading · Error · Allowed · Disabled ·
Risk.**

**Decisions** — Purpose: browse the decision ledger read-only. · Endpoints: `GET
/api/decisions?limit&offset`, `GET /api/decisions/{id}`. · Shows: table of id/title/status/
risk_level/created_at; detail panel adds decision_text, summary, evidence, created_by,
approved_by, agent_run_id. · Empty: "No decisions yet." · Loading: `Loading`. · Error:
`ErrorState` (incl. NETWORK "backend unreachable"). · Allowed: list, filter (client-side),
open detail, load more. · Disabled: **no approve / reject / execute / patch buttons.** ·
Risk: execute is high-risk + gated — not in W2; viewers see approved only.

**Tasks** — Purpose: read-only mission board. · Endpoints: `GET /api/tasks?status&limit&offset`,
`GET /api/tasks/{id}`. · Shows: title/status/priority/owner/risk_level/due_date/`overdue`;
detail adds description, source_decision_id. · Empty: "No tasks yet." · Loading/Error: std.
· Allowed: list, filter by status (server `?status=`), open detail, load more. · Disabled:
**no create / status change / from-decision.** · Risk: none read-only; show `overdue` flag.

**Approvals** — Purpose: visibility into the governance queue. · Endpoints: `GET
/api/approvals/pending`, `GET /api/approvals`. · Shows: requested_action, risk_level,
status, requested_by, approved_by, whether a `confirmation_phrase` is required,
created_at. · Empty: "No pending approvals." · Loading/Error: std. · Allowed: view pending
+ history. · Disabled: **no approve / reject buttons in W2** (resolution flow + critical
confirmation phrase is a later sprint). · Risk: highest-governance screen — display the
risk tier and "founder/admin resolves" note; do not imply the UI can approve.

**Knowledge Vault** — Purpose: browse local documents read-only. · Endpoints: `GET
/api/knowledge/documents?limit&offset`, `GET /api/knowledge/documents/{id}`. · Shows:
filename/file_type/document_status/trust_level/chunk_count/created_at; detail adds
sensitivity_level, owner, client/project, sha256, metadata. · Empty: "No documents
ingested yet." · Loading/Error: std; **403 → "Requires READ_KNOWLEDGE (your role can't
view documents)."** · Allowed: list, open detail, load more, trust/status filter
(client-side). · Disabled: **no ingest / verify / deprecate / reindex / delete; no search
box** (search is POST + needs Ollama → W3). · Risk: flag `untrusted`/low-trust + deprecated
visually; delete is high-risk + gated — excluded.

**Conversations (list)** — Purpose: read-only list of conversations. · Endpoints: `GET
/api/conversations?limit&offset`, `GET /api/conversations/{id}` (metadata only). · Shows:
title/status/created_at; detail shows title/status/owner. · Empty: "No conversations yet."
· Loading/Error: std. · Allowed: list, open metadata, load more. · Disabled: **no message
thread, no compose/send** (message view + chat = W3 AI Council). · Risk: 403 cross-user is
expected for non-owners (founder exempt) — render as honest "no access," not an error toast.

**Observatory (enrich)** — Purpose: add read-only ops visibility. · New endpoints: `GET
/api/workflows/runs`, `GET /api/tools`. · Shows: Workflow Runs card (name/status/created_at,
honest `skipped`/`failed`/`completed`); Tool Registry card (name/risk_level/
required_permission/audit/description). · Empty/Loading/Error: std per card. · Allowed:
view only. · Disabled: **no trigger, no execute.** · Risk: read-only registry/log view.

**Dashboard (enrich)** — Purpose: link hub using data already returned. · Endpoint: existing
`GET /api/metrics/overview` (already has `decisions`, `tasks` maps + `pending_approvals`).
· Shows: decision status breakdown, task status breakdown, pending-approvals stat — each
linking to the new pages. · Empty/Error: per-card "data unavailable" (never zeros-as-real).
· Allowed: read + navigate. · Disabled: none (no actions). · Risk: keep local-only badge +
hardware warning already present.

---

## 2. Component Plan (add to `components/ui.tsx`; reuse existing where noted)

- **`DataTable<T>`** — props `{ columns: {key,label,render?}[], rows: T[], rowKey }`.
  Dedupes the `<table className="table">` markup repeated across pages. *(new)*
- **`StatusBadge`** — maps status string → existing `Badge` tone (approved/done/
  completed/indexed→ok; pending/draft/backlog/raw/parsed→muted; rejected/failed/
  deprecated→bad; revised/blocked/skipped→warn). *(new; wraps `Badge`)*
- **`RiskBadge`** — `low→muted, medium→warn, high→bad, critical→bad` (+ label). *(new; wraps `Badge`)*
- **`PageHeader`** — `{title, subtitle?}` → the existing `.page-head` block. *(new, optional)*
- **`DetailDrawer`** — right-side panel `{open, onClose, title, children}` for `{id}` detail
  via `GET .../{id}`; reuses `Loading/ErrorState/Row`. *(new)*
- **`LoadMore`** — `{onClick, loading, done}` button implementing offset pagination; hidden
  when last page returned `< limit`. *(new)*
- **Reuse as-is:** `Card`, `Badge`, `Row`, `Stat`, `Loading`, `ErrorState`, `Empty`,
  `useAsync`. For paginated lists, add a tiny `usesPaged` variant **or** manage
  `offset`/accumulated rows with `useState` + manual `apiFetch` (don't fork `useAsync`'s
  single-shot contract).

Keep styling in `index.css` (extend classes; no new CSS framework, no external CDN).

---

## 3. API Client Additions (`api/client.ts`)

Add these to the `api` object (typed; reuse `apiFetch`). Response shapes below are taken
from the uploaded routes.

```
api.decisions(limit=100, offset=0)  → { decisions: DecisionBrief[]; total: number }
api.decision(id)                    → DecisionDetail
api.tasks(opts?{status,limit,offset})→ { tasks: TaskBrief[]; total: number }
api.task(id)                        → TaskDetail
api.approvals(limit=100,offset=0)   → { approvals: Approval[] }
api.approvalsPending()              → { pending: Approval[] }
api.documents(limit=100,offset=0)   → { documents: DocBrief[]; total: number }
api.document(id)                    → DocDetail
api.conversations(limit=100,offset=0)→ { conversations: ConvBrief[]; total: number }
api.conversation(id)                → ConvDetail
api.workflowRuns()                  → { runs: WorkflowRun[] }
api.tools()                         → { tools: Tool[] }
```

New `types.ts` interfaces (fields verified against route `_brief`/detail returns):
- `DecisionBrief {id,title,status,risk_level,agent_run_id:string|null,created_at}`;
  `DecisionDetail = DecisionBrief & {decision_text,summary,evidence,created_by,approved_by}`
- `TaskBrief {id,title,status,priority,owner:string|null,risk_level,due_date:string|null,overdue:boolean,created_at}`;
  `TaskDetail = TaskBrief & {description,source_decision_id:string|null}`
- `Approval {id,requested_action,risk_level,status,requested_by,approved_by,confirmation_phrase:string|null,created_at}`
- `DocBrief {id,filename,file_type,document_status,trust_level,chunk_count,created_at}`;
  `DocDetail = DocBrief & {sensitivity_level,owner,client_name,project_name,sha256,metadata}`
- `ConvBrief {id,title,status,created_at}`; `ConvDetail {id,title,status,user_id:string|null}`
- `WorkflowRun {id,workflow_name,status,created_at}`
- `Tool {name,description,risk_level,required_permission,audit,input_schema}`

Rules to honor (already supported by `apiFetch`):
- **Auth:** every W2 call uses `auth:true` (default) → Bearer token attached.
- **Pagination:** pass `?limit=&offset=`; treat `total` as page length; `LoadMore` does
  `offset += limit` and stops when `rows.length < limit`. Use `limit=100`.
- **Errors:** let `ApiError`/`AuthError` propagate; `AuthError` (401) → client already
  cleared token; route to `/login`. Surface `NETWORK` as "backend unreachable".
- **202:** keep the global `ApprovalRequiredError` catch; W2 makes no mutating calls, but if
  one ever fires, show "requires founder approval — not available in this view," never a
  success state.

---

## 4. W2 QA Checklist

- [ ] Login still works; refresh keeps session (`/auth/me`); sign-out clears token.
- [ ] Each of the 5 pages loads **real** data or an honest **empty** state.
- [ ] Loading shows `Loading`; backend down shows `NETWORK` error, not a blank/zeroed page.
- [ ] 401 anywhere → token cleared → redirect to `/login`.
- [ ] **No high-risk controls present**: no approve/reject/execute/trigger/tool-execute/
      ingest/verify/deprecate/reindex/delete buttons anywhere in W2.
- [ ] No dummy data; no fake "success"; `skipped`/`failed`/`deprecated`/`untrusted` shown
      truthfully via badges.
- [ ] Pagination uses `limit`+`offset`; "Load more" disappears when a page returns `< limit`;
      no fabricated grand total.
- [ ] Knowledge page handles **403** (viewer lacks `READ_KNOWLEDGE`) with a clear message.
- [ ] Conversations: non-owner 403 renders as honest "no access" (founder can view).
- [ ] Local-only badge + hardware warning still visible (AppShell unchanged).
- [ ] Global `ApprovalRequiredError` path still intact (no silent swallow).
- [ ] Basic responsiveness: tables scroll/stack on narrow viewport; nav usable on mobile.
- [ ] `npm run build` (`tsc --noEmit && vite build`) passes with no type errors.

---

## 5. Main Claude — W2 Implementation Prompt (YAML)

```yaml
ROLE: Main Claude — sole code executor for the Thunity Command Center frontend (Shot 3 W2)
GOAL: Wire 5 read-only pages + enrich Observatory & Dashboard. Read-only only. No W3 chat.
REUSE_W1:
  - api/client.ts (apiFetch, ApiError/AuthError/ApprovalRequiredError), auth/AuthContext,
    components/ui.tsx (Card,Badge,Loading,ErrorState,Empty,useAsync), index.css, react-router.
BUILD:
  pages_replace_stubs:
    - Decisions:     GET /api/decisions, GET /api/decisions/{id}   (list+detail, read-only)
    - Tasks:         GET /api/tasks(?status), GET /api/tasks/{id}   (list+detail, read-only)
    - Approvals:     GET /api/approvals/pending, GET /api/approvals (view queue, NO resolve)
    - Knowledge:     GET /api/knowledge/documents, GET /.../{id}    (browse+detail; handle 403)
    - Conversations: GET /api/conversations, GET /.../{id}          (list+metadata; NO messages)
  enrich:
    - Observatory: add cards for GET /api/workflows/runs and GET /api/tools (read-only)
    - Dashboard:   add decision/task status + pending_approvals cards from metrics/overview
  components_add: DataTable, StatusBadge, RiskBadge, DetailDrawer, LoadMore, (PageHeader)
  client_add: decisions, decision, tasks, task, approvals, approvalsPending, documents,
              document, conversations, conversation, workflowRuns, tools  (+ types.ts ifaces)
  routing: remove `stub:true` for the 5 pages in AppShell NAV; add real routes in App.tsx;
           keep council/workflows/tools/settings as stubs.
RULES:
  - Pagination: limit=100 + offset; "Load more" until page < limit; never show a fake total.
  - Every page: real API + honest loading/empty/error/offline states; no dummy data.
  - NO buttons for: approve, reject, execute, trigger, tool execute, ingest, verify,
    deprecate, reindex, delete. Keep global 202 approval_required handling.
  - Do NOT edit backend. Do NOT start W3 AI Council chat/messages. Do NOT add a CSS
    framework or external CDN. Keep it local-only.
VERIFY:
  - npm run build  (tsc --noEmit && vite build) must pass.
  - Manually click each page: real data or honest empty; 401 → login.
REPORT_BACK:
  - files created/changed; build result; any endpoint that didn't match the expected shape.
```
