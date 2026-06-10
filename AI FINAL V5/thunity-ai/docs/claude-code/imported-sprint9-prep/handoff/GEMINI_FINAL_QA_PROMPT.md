# Gemini — Final QA Prompt (paste as-is)

> Paste the prompt below into Gemini and attach the backend (the `thunity-ai/` repo or
> zip) plus the `docs/` folder. It is self-contained.

---

You are a senior QA + release-readiness engineer doing the final functional review of a
backend before its frontend phase. The system is **Thunity Local AI Company OS** — a
private, local-first AI "company brain" whose promise is **"your company brain stays on
your machine."** Your focus is correctness, consistency, and **docs-vs-code accuracy** —
not adversarial security (a separate red-team covers that).

Architecture facts (verify against the attached code):
- FastAPI + async SQLAlchemy; local stack: Ollama (only inference path), PostgreSQL,
  Redis, n8n. No cloud AI in the core path. bcrypt/JWT auth; RBAC
  founder/admin/operator/analyst/viewer. Decisions/tasks/approvals with high-risk
  approval gates; registered-tool + allow-listed-workflow governance; append-only audit.
- Hardware target: Ryzen 7 5800X, RX 6600 XT (8GB VRAM), 16GB RAM; 7B/8B default models,
  sequential execution; 14B opt-in only.

Produce a **pass/fail report per item** with reproduction notes, plus a **doc-vs-code
drift list**. Cover:

1. **Build/startup:** `docker compose up -d` brings up all services; startup seeds roles,
   default prompts, and the founder user idempotently; required models pull cleanly and
   `/api/models/health` flags heavy models + missing-model `ollama pull` hints.
2. **Gates:** `cd backend && pytest -q` (all pass — record counts);
   `python scripts/check-local-only.py` exits 0 / "PASS".
3. **Auth/RBAC matrix:** login returns token+role+permissions; each role can do exactly
   its permitted actions and is blocked elsewhere; `/api/auth/me` matches.
4. **AI Council:** `POST /api/agents/council` returns 5 stages + an evaluation; the final
   response contains the mandatory sections (`EXECUTIVE VERDICT`, `DECISION`, `RISKS`,
   `LOCAL-ONLY COMPLIANCE`, `HARDWARE FIT`, `ACCEPTANCE CRITERIA`, `NEXT STEP`);
   `save_as_decision` + `create_tasks_from_output` create linked, traceable records;
   conversation memory persists user + assistant; an Ollama-offline stage is recorded as
   `failed` (no crash, no cloud).
5. **RAG:** ingest each supported type (txt/md/csv/json/xlsx/pdf/yaml); chunks +
   embeddings created; CSV/XLSX schema detected; search returns ranked results with
   trust/lifecycle filtering (deprecated/archived excluded), low-trust warnings, and a
   "Sources used:" grounding block; verify/deprecate/reindex behave.
6. **Governance:** decision draft → approve/reject → gated execute; task from decision;
   approval tiers + critical confirmation phrase.
7. **Workflow/tools:** `/api/workflows/allowed` lists the six; low-risk trigger persists
   a run with honest status; high-risk requires approval; `/api/tools` metadata correct;
   honest `not_implemented` where no handler is bound.
8. **Observability/backup/hardware:** `/api/metrics/overview` counts reconcile with DB
   state; backup→restore round-trip restores DB + data and the archive excludes the real
   `.env`; `/api/hardware/status` fields are correct and the CPU-fallback warning behaves
   on the real GPU.
9. **Consistency:** error contract `{error, code, message, detail, suggested_action}` is
   uniform; prompts answer in the user's language (Indonesian/English).
10. **Docs accuracy:** cross-read each `docs/*.md` against the code and list any drift
    (endpoints, model defaults, statuses, limits). Confirm limitations are stated
    honestly (sandbox executes nothing yet; GPU acceleration unconfirmed on gfx1032;
    linear-cosine vector search; backend network binding).

Deliverable: the pass/fail table, the doc-vs-code drift list, and a short "ready for Shot
3? yes/no + blockers" verdict.
