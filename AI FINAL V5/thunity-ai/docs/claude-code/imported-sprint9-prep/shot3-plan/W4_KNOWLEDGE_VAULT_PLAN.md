# Shot 3 — W4.1 Knowledge Vault Micro-Plan (for Main Claude)

Plan + prompt only. Builds on the W2 read-only Knowledge Vault (documents list + detail).
Grounded in the uploaded `backend/api/routes/knowledge.py`. No code here.

## Recommended W4.1 Scope
Smallest safe increment = let the existing Vault **add** documents (additive, local,
non-destructive) and display their metadata well. Concretely:
1. **Document upload/ingest UI** → `POST /api/knowledge/ingest` (multipart). Honest
   idle→uploading→result/error flow.
2. **Metadata display polish** on list + detail: `document_status`, `trust_level`,
   `sensitivity_level`, `file_type`, `chunk_count`, owner/client/project, `sha256`,
   `created_at` — using a trust badge + the W2 `StatusBadge`.
3. **Upload guidance**: show supported types + size limit before/at upload (mirror backend;
   don't hard-block beyond what the backend enforces).
4. **Honest result**: after a 200, show the returned `document_status` and
   `trust_level` (new docs are `untrusted`/`indexed`) — never imply "verified/ready."

Defer knowledge **search** to W4.2 (read-only but Ollama-dependent) — inspect first.

## Backend Endpoints To Inspect (before implementing)
- `POST /api/knowledge/ingest` — confirm: **required permission** (likely `UPLOAD_FILES`)
  to gate the button; exact **Form field names** (`client_name`, `project_name`,
  `sensitivity_level`, `source_type`?); multipart contract; response keys
  (`document_id, filename, chunks, document_status, trust_level`).
- `file_service` limits — confirm ingest-supported extensions (txt, md, csv, json, xlsx,
  xls, pdf, yaml, yml) and `MAX_UPLOAD_MB` (≈50) to drive client guidance.
- `api/client.ts` — `apiFetch` forces JSON content-type; **add an `apiUpload(path,
  FormData)` helper** (Authorization header only, let the browser set the multipart
  boundary). Extend, don't break `apiFetch`. *(inspect before implement)*
- *(optional/W4.2)* `POST /api/knowledge/search` — confirm it's safe + its Ollama
  dependency before any search UI.
- Reuse W2's `GET /documents` and `GET /documents/{id}` unchanged.

## UI Safety Rules
- Real backend only; render `document_status` + `trust_level` verbatim. No fake success —
  show "ingested" only on a 200 with a `document_id`; otherwise an honest error
  (unsupported type, >size, 401, NETWORK, or Ollama offline → embedding failed).
- Gate the upload control on the user's upload permission (from `/auth/me`); hide it for
  roles without it and handle 403 honestly.
- Local-only: upload targets only the local backend — no external/cloud destination, no
  external CDN. Keep the local-only badge and global `ApprovalRequiredError` (202) handling.
- Progress may be an indeterminate spinner; don't fabricate a percentage you can't measure.

## What Must Not Be Added Yet
- No delete (high-risk, gated) — no delete UI at all.
- No verify / deprecate / reindex (trust/governance mutations) until an approval flow exists.
- No `use_knowledge_base` toggle in AI Council; no auto-grounding wiring.
- No search UI in W4.1; no bulk upload, no client-side file parsing/preview.

## Main Claude W4.1 Implementation Prompt (ready to paste)

```yaml
ROLE: Main Claude — sole code executor, Thunity Command Center frontend (Shot 3 W4.1)
GOAL: Add SAFE document upload/ingest + metadata polish to the existing Knowledge Vault.
      Additive only. No delete/verify/deprecate/reindex. No search yet. No AI grounding yet.
INSPECT_FIRST (do not assume):
  - backend/api/routes/knowledge.py POST /ingest: required permission, exact Form field
    names, response keys (document_id, filename, chunks, document_status, trust_level).
  - file_service: ingest-supported extensions + MAX_UPLOAD_MB (for client guidance).
  - src/api/client.ts: apiFetch sets JSON content-type — add apiUpload(path, FormData)
    (Authorization header only; NO Content-Type) without changing apiFetch.
REUSE_W1_W2:
  - apiFetch/ApiError/AuthError/ApprovalRequiredError, AuthContext, ui.tsx
    (Card,Badge,StatusBadge,Loading,ErrorState,Empty,DataTable,DetailDrawer,useAsync), index.css.
BUILD:
  - api.ingestDocument(formData) via new apiUpload(); types for the ingest response.
  - Knowledge page: add an "Add document" panel (file input + optional client/project/
    sensitivity fields matching the real Form names) shown ONLY if user has the upload
    permission; on submit → uploading state → on 200 show returned status+trust and refresh
    the list; on error show the honest message.
  - Polish list/detail: trust badge + status badge + sensitivity/chunk_count/sha256/owner.
  - Show supported types + size limit as guidance text near the input.
RULES:
  - Real API only; no fake ingestion success (success requires a 200 + document_id).
  - New docs are untrusted/indexed — display verbatim; never imply verified/ready/trusted.
  - NO delete, verify, deprecate, reindex, search, or use_knowledge_base toggle.
  - Local-only: upload only to the local backend; no external CDN. Keep local-only badge +
    global 202 handling. Handle 401→login, 403→hide/deny, NETWORK→"backend unreachable",
    Ollama-offline ingest error honestly.
  - Do NOT edit the backend. Do NOT start W4.2 search or any AI Council grounding.
VERIFY:
  - npm run build (tsc --noEmit && vite build) passes.
  - Manually: upload a supported file → real success + list refresh; oversized/unsupported
    → honest error; role without permission → no upload control.
REPORT_BACK: files changed; build result; the confirmed ingest permission + Form fields;
  any response shape that differed from expected.
```
