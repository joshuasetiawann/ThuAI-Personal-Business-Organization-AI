# Project Memory — for the next AI working on Thunity

Read this first. It captures current state + guardrails so you don't re-derive or break things.

## Current status: demo-ready
Local-first AI company OS. Frontend = Vite + React + TS (`frontend/`), dev on `:3000` (matches backend CORS). Backend = FastAPI (`backend/`) on `:8000`, local Ollama/Postgres/Redis/n8n. Core promise: **your company brain stays on your machine.**

## Completed surfaces (routed + compiling)
Dashboard (Founder Daily Briefing), Knowledge Vault (upload/ingest + search), AI Council (4 agents + evaluator, optional Knowledge Base, source grounding, save-as-draft-decision, create-task), Conversations (list + transcript), Decisions (list/detail + Mark-as-Executed), Tasks (Mission Board), Approvals (resolve + critical confirmation), Workflows Lite (allow-list, low/medium trigger), Tools Registry (display-only), Audit Trail, System Observatory, **Settings & Governance** (read-only). Only intentional stub remaining: none in nav (Settings now real).

## Safety posture (DO NOT weaken)
- **Local-only**: Ollama for reasoning + embeddings; no cloud/external AI in core path; `LOCAL_ONLY_MODE` enforced + audited.
- **No fake success**: skipped/failed/offline/not_implemented shown verbatim; success requires real 200 + expected status.
- **Explicit clicks only**: confirmations on draft decision, task create, decision execute, critical reject.
- **Approval-gated high-risk**: high/critical decisions/workflows/tools need an approved approval; critical needs a confirmation phrase. Resolving an approval updates **status only** — it does not execute the action.
- **Do NOT**: reinstall/pull/reset Ollama models; delete Postgres/Ollama/n8n/Redis volumes; `docker compose down -v`; `docker system prune --volumes`; change model names / `.env` secrets; add backend schema changes/migrations in a UI sprint.

## Frontend conventions
- API in `src/api/client.ts` (`apiFetch` + `apiUpload`): handles 401 (clears token + `thunity:unauthorized` event → login), 202 `approval_required` → `ApprovalRequiredError`, `ABORTED`, structured `ApiError`.
- UI kit in `src/components/ui.tsx`: `Card, Badge, RiskBadge, StatusBadge, TrustBadge, Row, DataTable, DetailDrawer, LoadMore, PageHeader, Loading, ErrorState, Empty, useAsync, usePaged`.
- Patterns: `usePaged` for `limit=100&offset` lists; per-row busy guards; honest empty/loading/error everywhere.
- Build quirk: delete `frontend/dist` before `npm run build` (sandbox OS-locks old `dist` → EPERM; fine on real machines). Verify with `npx tsc --noEmit` + `vite build`.

## Known issues / gaps
- **AI Council is slow for trivial prompts** (runs full 6-stage council even for "halo"). Needs a lightweight/single-agent path for small talk; make council feel purposeful + chatbot-like.
- **Memory/conversation UX** thin — need easier access to previous chats + per-run navigation.
- **No deep links** between Audit ↔ Conversation ↔ Decision ↔ Approval. The `agent_run` audit event carries only `run_id` (no `conversation_id`) and there's no `GET /api/agents/runs/{id}` — a small **backend** addition would unlock real deep links.
- **Approval handoff is manual**: after a 202 the founder copies the `approval_id` across pages by hand (Decisions has a paste field). Worth a guided handoff.
- **Local process/database visibility** could be clearer for the founder.
- **GPU acceleration "unconfirmed"** (RX 6600 XT / gfx1032 + Ollama ROCm) — investigate; currently surfaced honestly as CPU-fallback warning.

## Next recommended sprint (after review)
Observability + conversation/memory UX + approval-handoff polish (and the small backend deep-link field). Prefer polish over new power.

## Do NOT start yet
Document delete / verify / deprecate / reindex, backup/restore from UI, full tool execution (handlers are intentionally inert → `not_implemented`), high-risk workflow trigger from UI, arbitrary payload / free-form workflow or tool args, auto-execute / auto-approve.
