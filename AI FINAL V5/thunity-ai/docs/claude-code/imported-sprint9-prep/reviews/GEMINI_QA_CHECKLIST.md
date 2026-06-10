# Gemini QA Checklist (after Sprint 9)

Functional / correctness QA (complements Grok's adversarial pass). Goal: confirm
everything works as documented, the docs match the code, and behavior is consistent.

## Build / run / startup
- [ ] `docker compose up -d` brings up ollama, postgres, redis, n8n, backend.
- [ ] Pull the required models; `GET /api/models/health` shows none missing and flags
  heavy models.
- [ ] Startup seeds roles, default prompts, and the founder user (idempotent on restart).

## Test & compliance gates
- [ ] `cd backend && pytest -q` — all pass; record counts.
- [ ] `python scripts/check-local-only.py` — exit 0 / "PASS".

## Auth & RBAC matrix
- [ ] Login returns token + role + permissions; `/api/auth/me` matches.
- [ ] Each role (founder/admin/operator/analyst/viewer) can do exactly its permitted
  actions and is blocked elsewhere.

## AI Council
- [ ] `POST /api/agents/council` returns 5 stages + evaluation; final response contains
  the mandatory sections (`DECISION`, `LOCAL-ONLY COMPLIANCE`, `HARDWARE FIT`, …).
- [ ] `save_as_decision` + `create_tasks_from_output` create linked decision/tasks with
  traceability.
- [ ] Conversation memory persists user + assistant messages.
- [ ] Ollama-offline path records a `failed` stage gracefully (no crash, no cloud).

## Knowledge / RAG
- [ ] Ingest each supported type (txt/md/csv/json/xlsx/pdf/yaml); chunks + embeddings
  created; CSV/XLSX schema detected.
- [ ] Search returns ranked results with trust/lifecycle filtering; deprecated/archived
  excluded; low-trust warnings present; "Sources used:" grounding shown.
- [ ] Verify / deprecate / reindex transitions behave.

## Governance
- [ ] Decision draft → approve/reject → gated execute happy paths.
- [ ] Task create + from-decision.
- [ ] Approval tiers + critical confirmation phrase.

## Workflow / tools
- [ ] `GET /api/workflows/allowed` lists the six; trigger low-risk → persisted run with
  honest status; high-risk → approval required.
- [ ] `GET /api/tools` metadata; execute registered/low-risk; honest `not_implemented`
  where no handler.

## Observability
- [ ] `/api/metrics/overview` counts reconcile with DB state (decisions, tasks, docs,
  workflow/tool/audit counts, `pending_approvals`, `last_backup`, `local_only_status`).
- [ ] `/api/metrics/{models,agents,knowledge,workflows}` return real aggregates.

## Hardware & backup
- [ ] `GET /api/hardware/status` fields correct; CPU-fallback warning behaves on the real
  GPU.
- [ ] Backup → restore round-trip restores DB + data; `.env` never in the archive;
  `last_backup` updates.

## Docs accuracy
- [ ] Cross-read each `docs/*.md` against the code; flag any drift (endpoints, model
  defaults, statuses, limits). Confirm limitations are stated honestly (sandbox, GPU,
  linear cosine, network binding, migrations).

## Consistency / i18n
- [ ] Error contract `{error, code, message, detail, suggested_action}` consistent across
  routes.
- [ ] Prompts answer in the user's language (Indonesian/English) as specified.

Deliverable: pass/fail per item with repro notes, plus a doc-vs-code drift list.
