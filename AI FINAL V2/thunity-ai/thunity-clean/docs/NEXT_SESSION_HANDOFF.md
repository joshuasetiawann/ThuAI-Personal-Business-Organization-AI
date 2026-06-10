# Next Session Handoff — Thunity Local AI Company OS

Compact handoff for the AI session after reset. Read this + `docs/PROJECT_MEMORY_FOR_NEXT_AI.md` first; do not broad-scan.

## 1. Current status
- Demo ran with Joshua; local stack working end-to-end: backend (FastAPI), database (Postgres), Ollama, n8n, frontend (Vite/React/TS).
- **Settings page is now real** (read-only): system mode, API/n8n config, webhook guide, models note, safety/governance.
- **Approval Gate now explains** how requests are created (collapsible help box).
- Sprints **W6.3 → W12 Lite completed**: draft decisions, backlog tasks, approval resolve, decision "Mark as Executed", Workflows Lite, Tools Registry, source-trust visibility, Founder Daily Briefing v2.
- Settings + post-demo docs completed.
- Build verified: `tsc --noEmit` clean, `vite build` clean. All nav pages routed; no nav stubs remain.

## 2. Demo feedback (Joshua)
- AI Council feels slow / a bit random for simple prompts (e.g. "halo").
- Wants a more **chatbot-like** experience.
- Wants better **memory / previous-conversation** UX.
- Wants a **screen-share** concept (later).
- Wants clearer **local process / database visibility**.
- Wants clearer **status/warning wording**.
- Approval request flow needed explanation (done).
- Settings needed n8n/webhook explanation (done).

## 3. Safety rules (hard constraints — do not break)
- Never delete Docker volumes; never delete the Ollama model volume.
- Never suggest/run model reinstall, pull, or download unless the founder explicitly asks.
- No auto-execute / no auto-approve. No fake success (skipped/failed/offline shown verbatim).
- High-risk actions stay approval-gated. Tools page stays registry-only. High-risk workflow trigger stays disabled.
- Decision "Mark as Executed" = ledger status + audit only (no workflow/tool run).
- No backend schema changes / migrations in a UI sprint. Don't `docker compose down -v` or prune volumes.

## 4. Known issues
- AI Council local inference can take many minutes per run (sequential 7B/8B; slower on CPU fallback).
- GPU acceleration shows **unconfirmed** in the UI (RX 6600 XT / gfx1032 + Ollama ROCm) — surfaced honestly, not a blocker.
- Workflow runs may show **failed/skipped** — keep honest.
- "Missing model" warning means the model is **not visible to the app**, not an instruction to reinstall.
- Approval handoff is still **manual** (copy/paste `approval_id` into Decisions' field after resolving).
- Settings is **read-only**; no editable config yet.
- No deep links between Audit ↔ Conversation ↔ Decision ↔ Approval (the `agent_run` audit event lacks `conversation_id`; no `GET /api/agents/runs/{id}`).
- Build quirk: delete `frontend/dist` before building (sandbox OS-locks old `dist` → EPERM; fine on real machines). Project is not under git in this environment.

## 5. Recommended next sprint
- **Priority A:** Observability + deep-link + conversation-memory polish (a small backend field — `conversation_id` on the `agent_run` audit event, or `GET /api/agents/runs/{id}` — unlocks real deep links; coordinate before touching backend).
- **Priority B:** Chatbot-like lightweight mode so trivial prompts don't run the full Council.
- **Priority C:** Council performance profiling.
- **Avoid for now:** W13 document governance, W14 delete, W15 restore, full tool execution, high-risk workflow trigger.

## 6. Exact next prompt for future Claude
> "Read docs/NEXT_SESSION_HANDOFF.md and docs/PROJECT_MEMORY_FOR_NEXT_AI.md first. Do not broad scan. Propose one safe micro-task only."
