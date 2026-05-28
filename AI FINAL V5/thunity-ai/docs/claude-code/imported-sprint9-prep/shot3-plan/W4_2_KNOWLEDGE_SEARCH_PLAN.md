# Shot 3 — W4.2 Knowledge Search Micro-Plan (for Main Claude)

Inspected `knowledge.py`, `Knowledge.tsx`, `client.ts`, `types.ts`. A safe search endpoint
exists. W4.2 = **search-only, read-only**; AI Council grounding stays future.

## W4.2 Recommended Scope
Add a **Search** panel to the existing Knowledge page: query input (+ optional `top_k` and
`client_name` filter) → call `POST /api/knowledge/search` → render ranked results with
trust/status badges + the backend `grounding` line. No mutations, no AI wiring. Reuse the
existing `Card`, `TrustBadge`, `StatusBadge`, `Loading/ErrorState/Empty`, `useAuth`.

## Confirmed Search Endpoint Contract
- **Endpoint:** `POST /api/knowledge/search` · **Permission:** `READ_KNOWLEDGE`
  (operator/analyst/admin/founder; **viewer → 403**).
- **Request:** `{ query: string, top_k?: number = 5, client_name?: string | null }`.
- **Response:** `{ results: Source[], grounding: string }` where each `Source` =
  `{ document_id, chunk_id, filename, content_preview, relevance, relevance_score,
  trust_level, document_status, sensitivity_level, page?, sheet?, warning?: string|null,
  metadata?: { client_name, project_name } }`. `grounding` is a human-readable
  "Sources used:" string (or a "no local knowledge source was used" line when empty).
- **Ollama dependency:** YES. Search embeds the query via local `nomic-embed-text`. If
  unavailable, backend returns **503 `SEARCH_FAILED`** ("embedding unavailable?"). Empty
  corpus or no match → `200` with `results: []` + a grounding note.
- **Client state today:** `api` has `documents`/`document`/`ingestDocument` but **no
  `search`** → add it. `types.ts` has `DocBrief/DocDetail/IngestResult` but **no `Source`**
  → add. Deprecated/archived docs are already excluded server-side.

## Safety Rules
- Real API only; render `relevance_score`, `trust_level`, `document_status`, and each
  result's `warning` verbatim — flag low-trust/untrusted sources; never imply authority.
- No fake results: show matches only from a `200`; empty → honest Empty state + the
  grounding "no source used" line.
- Honest states: idle (no auto-search) · loading spinner · **503 → "Search unavailable —
  local embedding model (Ollama / nomic-embed-text) not reachable."** · 403 → "requires
  READ_KNOWLEDGE" · 401 → login · NETWORK → "backend unreachable."
- Search is a read-only POST (no data change); keep local-only badge + global 202 handling.
  Don't render full documents — only the backend `content_preview`.

## What Must Wait
- AI Council `use_knowledge_base` toggle / grounding wiring — **future** (W5+), not W4.2.
- verify / deprecate / reindex / delete — still excluded (governance/destructive).
- No pagination for search (backend returns `top_k` only); offer a small `top_k` selector
  (e.g., 5/10/20), not infinite scroll. No saved searches, no cross-page result actions.

## Main Claude W4.2 Implementation Prompt (ready to paste)

```yaml
ROLE: Main Claude — sole code executor, Thunity Command Center frontend (Shot 3 W4.2)
GOAL: Add a SAFE, read-only Knowledge Search panel to the existing Knowledge page.
      No mutations. No AI Council grounding yet.
CONTRACT (verified — do not re-inspect):
  endpoint: POST /api/knowledge/search   permission: READ_KNOWLEDGE (viewer→403)
  request:  { query: string, top_k?: number=5, client_name?: string|null }
  response: { results: Source[], grounding: string }
  Source:   { document_id, chunk_id, filename, content_preview, relevance_score,
              trust_level, document_status, sensitivity_level, page?, sheet?,
              warning?: string|null, metadata?: {client_name, project_name} }
  ollama:   required; if unavailable → 503 SEARCH_FAILED. empty/no-match → 200 results:[].
REUSE:
  - api/client.ts (apiFetch, ApiError/AuthError), ui.tsx (Card, TrustBadge, StatusBadge,
    Loading, ErrorState, Empty), AuthContext, index.css. Keep apiUpload/ingest from W4.1.
BUILD:
  - client.ts: add api.search(query, top_k=5, client_name?) → apiFetch POST /api/knowledge/search.
  - types.ts: add Source + SearchResponse { results: Source[]; grounding: string }.
  - Knowledge.tsx: add a Search Card ABOVE/beside the list — query input, optional top_k
    select (5/10/20) and client_name field, Search button (disabled if query empty).
    On submit: loading → render results (filename + trust/status badges + relevance +
    content_preview + warning) and the grounding line; honest empty/error/offline states.
RULES:
  - Real API only; no fake results; show trust/warning verbatim; preview only (no full doc).
  - Gate nothing extra, but handle 403 (no READ_KNOWLEDGE) honestly; 401→login; 503→
    "local embedding model unavailable"; NETWORK→"backend unreachable".
  - Do NOT add verify/deprecate/reindex/delete. Do NOT touch the backend. Do NOT enable
    AI Council use_knowledge_base / grounding. No external CDN; stay local-only.
VERIFY:
  - npm run build (tsc --noEmit && vite build) passes.
  - Manual: query with Ollama up → real ranked results + grounding; empty corpus → honest
    empty; Ollama down → 503 message; viewer role → 403 handled.
REPORT_BACK: files changed; build result; any Source field that differed from the contract.
```
