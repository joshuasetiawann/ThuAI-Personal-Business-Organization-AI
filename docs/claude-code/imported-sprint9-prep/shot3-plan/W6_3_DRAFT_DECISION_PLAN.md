# Shot 3 — W6.3: Save Council Result as DRAFT Decision (for Main Claude)

Inspected `decisions.py`, `agents.py`, `client.ts`, `types.ts`. A safe draft-create endpoint
exists; W6.3 is a small, additive frontend button. No backend change.

## Confirmed Decision Save Contract
- **Endpoint:** `POST /api/decisions` · **Permission:** `CREATE_DRAFT_DECISION`
  (analyst/admin/founder; operator/viewer lack it → 403).
- **Body (`DecisionCreate`):** `title` (required) · `decision_text=""` · `summary=""` ·
  `risk_level="medium"` · `conversation_id?` · `agent_run_id?`. *(No `evidence` field on this
  schema — don't send one.)*
- **Response:** `_brief` = `{ id, title, status, risk_level, agent_run_id, created_at }`,
  **status is `"draft"`** (set server-side). Returns `200` — **draft creation does NOT
  require approval**; only `POST /decisions/{id}/execute` on a high-risk decision returns
  `202`. So this call should be a normal 200; keep global 202 handling anyway.
- **Source data is already in hand:** `CouncilResult` has `final_response`, `agent_run_id`,
  `conversation_id`, `status`. Build the draft from the completed run — **do not** use the
  council's `save_as_decision` flag (that re-runs the council; keep it `false`).
- **Client gap:** `api` has `decisions`/`decision` (GET) but **no create** → add
  `api.createDecision(body)`. `types.ts` already has `DecisionBrief` (the response).

## W6.3 Recommended Scope
On the Council page, after a run with `status === "completed"`, show a **"Save as draft
decision"** button that calls `POST /api/decisions` with: `title` (editable, default =
message sliced to ~120 chars), `decision_text = final_response`, `summary = grounding_note`
(optional), `risk_level = "medium"` (optional low/medium/high select), `conversation_id`,
`agent_run_id`. On 200 → show "Saved as draft" + the returned id/status and a link to the
Decisions page. Nothing else.

## Safety Constraints
- Draft only. **No** execute, approve/reject, task creation, workflow/tool trigger.
- Success only on a real 200 with an `id` + `status:"draft"` — no fake success.
- Show the button only if the user has `create_draft_decision` (from `/auth/me`); handle
  403 honestly; 401→login; NETWORK→"backend unreachable".
- Keep council flags unchanged/false: `save_as_decision`, `create_tasks_from_output`,
  `allow_deep_reasoning`, and `use_knowledge_base` default false (opt-in only).
- Local-only (no cloud/CDN). Edit the Council page + client/types only; backend untouched.

## Main Claude W6.3 Implementation Prompt (ready to paste)

```yaml
ROLE: Main Claude — sole code executor, Thunity Command Center frontend (Shot 3 W6.3)
GOAL: After a completed AI Council run, allow saving the result as a DRAFT decision. Additive.
CONTRACT (verified — do not re-inspect):
  POST /api/decisions  perm: CREATE_DRAFT_DECISION (operator/viewer→403)
  body: { title (req), decision_text="", summary="", risk_level="medium",
          conversation_id?, agent_run_id? }   # NO evidence field
  resp: { id, title, status:"draft", risk_level, agent_run_id, created_at }  # 200, no approval
EDIT ONLY: src/pages/Council.tsx, src/api/client.ts, src/types.ts
BUILD:
  - client.ts: add api.createDecision(body) -> apiFetch("/api/decisions",{method:"POST",body}).
  - types.ts: reuse DecisionBrief for the response (add a DecisionCreateBody type if useful).
  - Council.tsx: when result.status==="completed", render "Save as draft decision" button
    (only if user.permissions includes "create_draft_decision"). On click → createDecision({
      title: editableTitle || message.slice(0,120), decision_text: result.final_response,
      summary: result.grounding_note ?? "", risk_level: chosen||"medium",
      conversation_id: result.conversation_id, agent_run_id: result.agent_run_id }).
    On 200 → show "Saved as draft (status: draft)" + link to /decisions. Honest loading/error.
RULES:
  - Draft only: NO execute, approve/reject, task create, workflow/tool trigger.
  - No fake success (require 200 + id). Do NOT use council save_as_decision flag; keep it false.
  - Keep create_tasks_from_output, allow_deep_reasoning false; use_knowledge_base default false.
  - Handle 403 (no permission → hide/deny), 401→login, NETWORK honestly. Local-only; no CDN.
  - Do NOT edit backend (unless build shows a type mismatch). Do NOT start W6.4.
VERIFY:
  - npm run build (tsc --noEmit && vite build) passes.
  - Manual: completed run → save → real draft appears in /decisions; operator/viewer sees no button.
REPORT_BACK: files changed + build status only.
```
