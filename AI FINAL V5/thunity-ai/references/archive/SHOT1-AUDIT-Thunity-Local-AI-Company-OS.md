# SHOT 1 — AUDIT REPORT
## Thunity Local AI Company OS

**Auditor:** AI Council (Shot 1 scope)
**Date:** 2026-06-01
**Codebase audited:** `ai-ecosystem.zip` (project name internally: *AI Ecosystem*)
**Scope:** Master context, codebase audit, architecture review, local-only compliance, security, hardware-fit, execution plan. **No large implementation performed.**

> Codebase size: ~6,600 lines, 65 files. Stack: FastAPI backend (Python), 2× static single-file HTML frontends, PostgreSQL + Redis + n8n + Ollama via Docker Compose, plus a dormant Supabase sync service and a pile of `fix-*.sh` patch scripts.

---

## 1. EXECUTIVE TECHNICAL VERDICT

**Classification:** **Local AI prototype (multi-agent chat demo)** — *not yet* an AI Company OS foundation. Security state alone drags it toward "prototype chatbot."

The reasoning core genuinely runs on local Ollama and the 3-agent debate streams correctly. That is the one real asset. Everything else required by the Thunity vision — persistence, knowledge/RAG, decisions, tasks, approvals, audit, governance, local-only enforcement, a Founder Command Center — is **absent, stubbed, or actively unsafe.** Critically: **nothing is ever written to the database**, and **every functional endpoint except `/api/auth/me` is unauthenticated.**

This is a fixable, decent *starting point* — the bones of a FastAPI service and a working Ollama integration exist — but it must be treated as a prototype to be hardened and rebuilt outward, not a foundation to extend as-is.

### Scorecard

| Dimension | Score | One-line justification |
|---|---|---|
| Local-only compliance | **3 / 10** | Core reasoning is Ollama (good), but `LOCAL_ONLY_MODE` does not exist; a Supabase cloud-sync service + UI + `OPENAI_API_KEY` field are present and unguarded. |
| Security | **1 / 10** | Plaintext `admin/admin123`, default `SECRET_KEY`, wildcard CORS w/ credentials, ~1 of 20 endpoints authed, upload path traversal, free n8n trigger. |
| Backend architecture | **4 / 10** | Reasonable FastAPI layout, but stub routes, duplicated route, duplicate service files, ORM↔SQL schema drift, invalid SQL, errors swallowed. |
| Agent architecture | **3 / 10** | Only 3 agents (not 4), no Evaluator/Execution-Engineer, prompts are for a business-case *contest* not Thunity, no run persistence, no versioning, no grounding. |
| Data persistence | **1 / 10** | Tables/models defined but **zero writes anywhere**; conversations API returns empty stubs. |
| RAG / knowledge base | **1 / 10** | None. Upload saves raw bytes only. No parse/chunk/embed/vector/retrieve/grounding. |
| Web / product experience | **3 / 10** | Two static HTML pages (dashboard + chat). Fake `Math.random` metrics fallback. Not a Command Center. |
| Hardware fit | **5 / 10** | 8B default + sequential is the *right instinct*, but unguarded; **RX 6600 XT (gfx1032) is not officially ROCm-supported by Ollama** → likely CPU fallback. No availability checks or warnings. |
| AI company readiness | **2 / 10** | Governance/memory/audit/decision layers — the actual product — do not exist yet. |
| **Overall** | **≈ 2.6 / 10** | A working local multi-agent chat demo with an unsafe perimeter. Real, but far from the vision. |

---

## 2. CURRENT PROJECT ARCHITECTURE MAP

```
ai-ecosystem/
├── backend/                      # FastAPI (Python 3, async)
│   ├── main.py                   # App, CORS=*, WS chat+monitor, DUPLICATE /chatbot route
│   ├── config.py                 # pydantic-settings; hardcoded SECRET_KEY + Supabase fields
│   ├── agents/
│   │   └── multi_agent.py        # 3 agents (analyst/critic/synthesizer) → Ollama streaming
│   ├── api/routes/
│   │   ├── auth.py               # JWT + HARDCODED USERS_DB (plaintext), only /me is protected
│   │   ├── agents.py             # /chat/stream (SSE), /health, /models  — no auth, no persistence
│   │   ├── conversations.py      # PURE STUBS (returns empty arrays / fake uuid)
│   │   ├── files.py              # list/read/write/upload — upload bypasses safe-path
│   │   ├── metrics.py            # psutil + live Ollama/n8n checks (REAL, but not stored)
│   │   └── n8n_webhooks.py       # /trigger any workflow — no auth, no allowlist, no approval
│   ├── services/
│   │   ├── database.py           # SQLAlchemy: Message/AgentLog/SystemMetric — created, NEVER written
│   │   ├── file_service.py       # FileManager (duplicate #1)
│   │   ├── websocket_manager.py  # streams agents; no persistence
│   │   └── supabase_sync.py      # ☁️ CLOUD sync service — instantiated, never wired in (dead)
│   ├── file-manager/
│   │   └── file_service.py       # FileManager (duplicate #2 — identical)
│   └── requirements.txt          # no passlib, no pgvector/chroma, no pdf/xlsx, no alembic, no pytest
├── frontend-dashboard/index.html # 1074-line static page; Math.random fake metrics; Supabase UI
├── frontend-chatbot/index.html   # 500-line static chat bubble UI
├── docker/
│   ├── postgres/init.sql         # schema (drifts from ORM); invalid CREATE DATABASE IF NOT EXISTS
│   └── nginx/nginx.conf          # reverse proxy
├── docker-compose.yml            # ollama, n8n, postgres, redis, backend, dashboard, chatbot, nginx
├── n8n-workflows/*.json          # 2 workflows (doc generator, daily report)
├── scripts/install.{sh,bat}
└── fix-*.sh, inject-*.sh, update-*.sh, write_html.sh   # 8 band-aid patch scripts (instability signal)
```

**Stack identified:** Backend = **FastAPI**. Frontend = **static HTML** (mislabeled "Next.js" in compose comments — there is no React/Next anywhere). DB = **PostgreSQL 15** + **Redis 7** (Redis configured but unused). Local models = **Ollama** (genuinely used). Workflows = **n8n** (local, sqlite-backed). Cloud = **Supabase** adapter present but dormant.

**Reality check:** The 8 `fix-*.sh` / `inject-chatbot.sh` / `write_html.sh` scripts inject HTML directly into running containers and re-patch the backend. They are why `main.py` contains the **same `/chatbot` route defined twice**. This is a project that has been hot-patched repeatedly rather than edited cleanly — a maintainability red flag.

---

## 3. LOCAL-ONLY COMPLIANCE AUDIT

**There is no `LOCAL_ONLY_MODE` anywhere in the codebase.** Nothing blocks external calls. The *de facto* local-only status today rests only on the fact that no cloud provider is currently configured — not on any enforcement.

| Finding | Location | Category | Notes / Risk |
|---|---|---|---|
| **Supabase sync service** (`upsert`, `fetch`, `sync_conversations`, `run_periodic_sync`) | `backend/services/supabase_sync.py` | **Optional disabled adapter (DEAD)** | Full HTTP egress to `SUPABASE_URL`. Instantiated as global `supabase_sync` but **never imported/called** by any route or startup. Disabled by default (`enabled = bool(url and key)`). Latent egress path — must be quarantined behind `LOCAL_ONLY_MODE`. |
| `SUPABASE_URL`, `SUPABASE_KEY` settings | `backend/config.py:14-15` | Optional disabled adapter | Empty by default. Should be removed from core config / moved to an optional adapter module. |
| Supabase in app description | `backend/main.py:18` ("Ollama + n8n + **Supabase**") | Documentation mention | Cosmetic but signals cloud as a first-class part of the product. Remove. |
| **Supabase Cloud Sync UI** ("Backup otomatis ke Supabase setiap malam", sync history panel) | `frontend-dashboard/index.html:536,626,641,723,1069` | Documentation/UI mention | The dashboard actively *invites* the founder to enable nightly cloud backup. Directly contradicts "your company brain stays on your machine." Remove in Shot 3. |
| `OPENAI_API_KEY=` (empty) | `.env:5`, `.env.example:5` | **Safe config residue** | No code reads it. No OpenAI client anywhere. Delete from `.env.example`. |
| `docker-compose` passes `SUPABASE_URL/KEY` to backend | `docker-compose.yml:114-115` | Optional disabled adapter | Empty defaults; remove from core compose. |
| Supabase fields echoed in patch script | `fix-backend.sh:126-127` | Documentation mention | Patch artifact. |
| Mentions in `install.sh` ("Ollama + N8N + Supabase + Multi-Agent") | `scripts/install.sh:16` | Documentation mention | Cosmetic. |

**No active OpenAI / Anthropic / Gemini / Groq / Together / Replicate / Pinecone / Weaviate / LangSmith / LangChain code paths exist.** The only real external-capable code is the dormant Supabase adapter.

**Embeddings / vector store:** none exist at all (local or remote) — so no remote-embedding leak today, but also no RAG (see §7).

**Verdict:** No *active* cloud reasoning path, but **no enforcement and a live latent egress (Supabase) plus a UI that promotes it.** Compliance is accidental, not guaranteed. Shot 2 Phase 1–2 must add real `LOCAL_ONLY_MODE` enforcement and quarantine Supabase.

### Expected `/api/health/local-only` endpoint (Section D)
- **Status: does NOT exist.** Only `/api/health` (returns `{status: online}`) and `/api/agents/health` exist.
- File to create in Shot 2: a new `backend/api/routes/health.py` (or extend `metrics.py`) returning the real compliance object (`local_only_mode`, `ollama_status`, `external_ai_providers_enabled`, `database`, `vector_store`, `n8n`, `status`).
- Dependencies to check live: Ollama (`/api/tags`), Postgres (engine ping), n8n (`/healthz`), and a static read of `LOCAL_ONLY_MODE` + whether any external adapter is enabled.

---

## 4. SECURITY AUDIT

**This is the most urgent section. The current security posture is unacceptable for anything beyond a throwaway localhost demo, and several issues directly violate the founder's stated security principles.**

| # | Issue | Location | Severity | Detail |
|---|---|---|---|---|
| S1 | **Hardcoded plaintext users** `admin/admin123`, `user/user123` | `auth.py:14-16` | 🔴 Critical | In-code dict; passwords compared in plaintext (`req.password != user["password"]`). No hashing despite `requirements.txt` lacking `passlib`/`bcrypt`. Directly violates "no admin/admin123." |
| S2 | **Default `SECRET_KEY`** = `"supersecretkey123changeme"` | `config.py:4`; compose default `supersecretkey123` | 🔴 Critical | JWTs are forgeable by anyone who reads the repo. Must come from env with no default. |
| S3 | **Wildcard CORS with credentials** | `main.py` `allow_origins=["*"]`, `allow_credentials=True` | 🔴 Critical | Insecure (and technically invalid combo). The `CORS_ORIGINS` env var that *is* set in compose is **ignored**. |
| S4 | **Almost no endpoint is authenticated** | all of `api/routes/*` except `auth.py:/me` | 🔴 Critical | `verify_token` is referenced by `/api/auth/me` only. Agents, files (read/write/upload), metrics, n8n-trigger, conversations are **fully open** to any caller. |
| S5 | **Upload path traversal** | `files.py:/upload` → `upload_dir / file.filename` | 🔴 Critical | Upload writes using the client-supplied filename **without** `_safe_path()`. A crafted `filename` can escape `FILES_DIR`. (Read/write/search *do* use `_safe_path`; upload does not.) |
| S6 | **Free n8n workflow trigger** | `n8n_webhooks.py:/trigger` | 🟠 High | Any caller can POST and trigger any workflow name, no auth, no allowlist, no approval gate. |
| S7 | Default Postgres password `postgres123` committed | `.env`, `.env.example`, compose | 🟠 High | Secret committed to repo; same value in example. |
| S8 | Default n8n basic-auth `admin/admin123` | `docker-compose.yml:52-53` | 🟠 High | Basic auth is at least *active*, but default creds. |
| S9 | DB-stored bcrypt admin (in `init.sql`) is **never used** | `init.sql:84` vs `auth.py` | 🟠 High | Two parallel auth systems; the *insecure* one (plaintext dict) is the live one. |
| S10 | Infra ports published to host w/o app auth | compose: 5432, 6379, 11434, 5678 | 🟡 Medium | Redis has no password; Ollama `OLLAMA_ORIGINS=*`. Acceptable-ish on a single trusted machine, but should bind to localhost. |
| S11 | No rate limiting, no audit of auth failures, no security headers | global | 🟡 Medium | No record of logins, failures, or sensitive actions (ties to §10). |

**`.env` is included in the zip** with real default secrets — it should never be committed; only `.env.example` (with `CHANGE_ME` placeholders) should ship.

---

## 5. BACKEND AUDIT

**Framework:** FastAPI + Uvicorn, async, with a sensible-looking `routes / services / agents` separation. That structure is the project's second real asset.

**Routes — real vs dummy:**
- `agents.py` — **real** (streams from Ollama) but **not persisted** and **not authed**.
- `metrics.py` — **real** (`psutil` + live Ollama/n8n probes); but values are computed on-demand, **never stored** → no history, no trends.
- `files.py` — real file ops; upload is unsafe (§S5).
- `n8n_webhooks.py` — real passthrough; ungoverned (§S6).
- `conversations.py` — **100% dummy stubs**: `list` → `{conversations: [], total: 0}`, `create` → random uuid not saved, `messages` → `{messages: []}`. This is the clearest "looks-real-but-empty" trap.

**Service layer:** Exists (`database`, `file_service`, `websocket_manager`, `supabase_sync`) but there is **no conversation/agent persistence service** — the layer that the whole product depends on. `file_service.py` is **duplicated** in two folders.

**Database / persistence — the headline finding:**
- SQLAlchemy models: only `Message`, `AgentLog`, `SystemMetric`. `init_db()` runs `create_all`. **But a full grep finds zero `session.add` / `commit` / `AsyncSessionLocal()` usage in any route or service.** → **Nothing is ever written.** Conversation history, agent runs, and metrics are all ephemeral.
- **No migration tool** (no Alembic). Schema comes from two competing sources that **disagree**: ORM `Message.conversation_id = String(255)` + `extra_data` vs `init.sql` `conversation_id UUID REFERENCES conversations(id)` + `metadata`.
- `init.sql` line 3 uses `CREATE DATABASE IF NOT EXISTS ai_ecosystem;` — **invalid PostgreSQL** (no `IF NOT EXISTS` for `CREATE DATABASE`); the init script would error on that line.
- `init_db()` **swallows all DB errors** and sets `engine = None`, so the app silently runs with no database and no warning to the user.
- Tables that the vision needs and that **do not exist in any form**: `agent_runs`, `agent_messages`, `documents`, `document_chunks`, `datasets`, `decisions`, `tasks`, `approval_requests`, `workflow_runs`, `evaluations`, `model_usage_logs`, `error_logs`, `audit_logs`, `prompt_versions`, `clients`, `projects`, `reports`, `artifacts`, `risks`, `notifications`, `sandbox_runs`, `roles`, `user_roles`.

**Error handling:** Inconsistent. Some routes raise `HTTPException`, others return `{success: false, error: str(e)}`, agents yield error *strings into the token stream*. No structured error contract (the `{error, code, message, detail, suggested_action}` shape from Section AC does not exist).

---

## 6. AGENT ARCHITECTURE AUDIT

| Aspect | Current state | Target (Thunity) | Gap |
|---|---|---|---|
| Agent count | **3** (analyst, critic, synthesizer) | **4** + Evaluator | Missing **Pragmatic Execution Engineer** and **Evaluator**. |
| Roles distinct? | Yes, prompts are genuinely different… | …and Thunity-aligned | …but they are written for a **business-case competition** (McKinsey/BCG, NPV, board defense), **not** for Thunity local-only/hardware-aware/security reasoning. Wrong domain. |
| Flow | analyst → critic → analyst(R2) → synthesizer | analyst → critic → **execution-eng** → analyst-revision → synthesizer → **evaluator** | No feasibility stage, no evaluation stage. |
| Execution mode | **Sequential** ✅ | Sequential | Correct for the hardware. Good. |
| Models per agent | All three default to **`llama3.1:8b`** | Per-agent (qwen2.5:7b, llama3.1:8b, qwen2.5-coder:7b…) | Config *has* 3 model vars but all set to the same model; no fast/embedding/execution/deep vars; no router. |
| Local inference | **Ollama, streaming** ✅ | Ollama | Works. Real asset. |
| Run persistence | **None** | `agent_runs` + `agent_messages` w/ model, latency, prompt version | Entirely missing. |
| Prompt versioning | Hardcoded in `AGENT_PROMPTS` dict | `prompt_versions` table + contracts dir | None. No `backend/agents/contracts/`. |
| Timeout / retry | 180s timeout ✅, **no retry** | timeout + retry + structured error | Partial. |
| Output contract | Free-form markdown | `EXECUTIVE VERDICT / DECISION / … / NEXT STEP` | Synthesizer format is close in spirit but not the required structured, parseable contract; nothing enforces `LOCAL-ONLY COMPLIANCE` / `HARDWARE FIT` fields. |
| Source grounding | **None** | Citations w/ chunk_id, relevance, trust | None (no RAG). |
| Model router / health | `check_ollama_health()` lists models ✅ | router + per-model availability + hardware warning | Health check exists; **no missing-model handling, no hardware warning, no `select_model()`**. |

**Bottom line:** The orchestration *engine* (sequential streaming debate) is sound and reusable. The *content* (prompts), the *cast* (3 vs 4+evaluator), the *memory* (no run logging), and the *governance* (no versioning, no grounding) all need to be rebuilt for Thunity in Shot 2.

---

## 7. KNOWLEDGE / RAG AUDIT

**There is no knowledge base and no RAG. Score 1/10 only because raw file storage exists.**

| Stage | Status |
|---|---|
| File upload | Exists — but **unsafe** (path traversal §S5), no size limit, no extension validation, no checksum, no unique id, no auth. |
| Document record | ❌ none (`documents` table absent). |
| Type detection / parsing | ❌ none. No `pypdf`/`pdfplumber`, no `openpyxl`/`pandas` in requirements. |
| Chunking | ❌ none. |
| Local embedding | ❌ none. `nomic-embed-text` is never used; no embedding code. |
| Vector store | ❌ none. No pgvector, no Chroma. |
| Retrieval (`retrieve_context`) | ❌ none. |
| Agent uses context | ❌ none — agents answer from model weights only. |
| Source grounding / citations | ❌ none. |
| Trust / lifecycle (status, sensitivity, trust_level) | ❌ none. |
| Dataset registry / Analytics Lab (CSV/XLSX schema detect) | ❌ none. |
| Local sandbox (`data/sandbox_runs`) | ❌ none. |

`backend/api/routes/files.py` has a `/search` that does naive substring grep over text files — not semantic retrieval. The only "knowledge" present is one sample file `data/files/documents/contoh-dokumen.md`.

This is the **largest build area** for the vision and is effectively greenfield (Shot 2 Phases 8–9).

---

## 8. DECISION / TASK / APPROVAL AUDIT

**None of the three exist.** This is the governance heart of "AI Company OS" and it is entirely missing.

- **Decisions:** no `decisions` table, no endpoints. The Synthesizer's final answer streams to the browser and **vanishes** — it cannot be saved, approved, rejected, revised, or executed.
- **Tasks / Mission Board:** no `tasks` table, no endpoints, no link from decision→task.
- **Approval Gate:** no `approval_requests` table, no risk levels, no founder-approval flow, no critical-confirmation phrase. Today, high-risk actions (file write, **n8n trigger**, would-be deletes) execute freely with no gate (§S6).
- **Tool Registry (Section W):** none. Agents cannot call tools at all yet, but there is also no registry/permission/risk scaffolding for when they can.

Greenfield (Shot 2 Phases 10–13).

---

## 9. n8n / WORKFLOW AUDIT

- **Local?** Yes — n8n runs in Docker, sqlite-backed, basic-auth active (default creds, §S8). Good that it is local.
- **Workflows present:** `auto-document-generator` (webhook → httpRequest → respond) and `laporan-harian` (schedule → httpRequest×3). Node types are `webhook`/`httpRequest`/`scheduleTrigger` — they call HTTP endpoints (intended to be the local backend/Ollama; should be verified they don't egress).
- **Governance?** **None.** `POST /api/n8n/trigger` will fire **any** workflow name, unauthenticated, with no allowlist registry, no approval, and **no `workflow_runs` persistence**. This is the opposite of "agent tidak boleh trigger workflow bebas."
- **Auditable?** No — runs are not recorded anywhere.

Needs the Section V governance layer (allowlist registry + approval link + `workflow_runs` table) in Shot 2 Phase 14.

---

## 10. OBSERVABILITY / AUDIT / BACKUP AUDIT

- **Metrics:** `psutil` system metrics and live Ollama/n8n probes are **real** (not dummy) on the backend — but computed on demand and **never persisted** (`system_metrics`/`model_usage_logs` unused/absent). No per-model usage, no latency history, no error rate, no agent timing. The `/api/metrics/overview|models|agents|knowledge|workflows` endpoints from Section Y **do not exist**.
- **Audit log:** **None.** No `audit_logs` table, no logging of logins/failures/file ops/agent runs/decisions/approvals/workflow triggers/settings changes. The product's auditability promise is currently unmet.
- **Backup / restore:** **None.** No `scripts/backup-local.sh` / `restore-local.sh`, no `data/backups`. Given everything is local and **nothing is even persisted yet**, data-loss risk is currently moot — but becomes critical the moment real persistence lands.
- **Error logs:** no `error_logs` table; errors print to stdout or stream to client.

---

## 11. FRONTEND / WEB APP AUDIT

**Current state: two static single-file HTML pages — a demo dashboard and a chat-bubble UI. It is not a Founder Command Center and not React/Tailwind.**

- `frontend-dashboard/index.html` (1074 lines): tabbed admin panel. Calls **real** endpoints (`/api/metrics/system`, `/api/metrics/services`, `/api/agents/chat/stream`, `/api/files/*`, `/api/n8n/trigger`) — **but** on fetch failure it falls back to **`Math.random()` fake CPU/memory numbers** (lines 830-831). That is exactly the "dummy data dressed as real" anti-pattern the founder forbade. Also hosts the **Supabase Cloud Sync** panel.
- `frontend-chatbot/index.html` (500 lines): single chat view → `/api/agents/health` + `/api/agents/chat/stream`. API base hardcoded to `http://localhost:8000`.
- **No login/auth UI**, no JWT usage → the (insecure) auth system isn't even exercised by the frontend.
- **No** component/service/types architecture, **no** role-aware layout, **no** local-only badge, **no** Command Center / Knowledge Vault / Decision Ledger / Mission Board / Approval Gate / Observatory / Audit Trail pages.
- Compose comments call these "Next.js" — they are plain HTML. Misleading.

Against the Section AE–AL vision, the web layer is **~5% there** and is a Shot 3 rebuild (do **not** start it until the backend is real — per the founder's own discipline rules).

---

## 12. HARDWARE FIT ASSESSMENT — RX 6600 XT 8GB / 16GB RAM / Ryzen 7 5800X

**The single most important hardware reality the current project ignores:**

> ⚠️ **The Radeon RX 6600 XT is `gfx1032` (RDNA2 "Navi 23"). Ollama's ROCm support officially targets `gfx1030` (RX 6800/6900) and newer CDNA. `gfx1032` is *not* on the official supported list.** In practice it usually requires the `HSA_OVERRIDE_GFX_VERSION=10.3.0` workaround, and even then ROCm on this card is fragile on consumer setups. **If ROCm does not initialize, Ollama silently falls back to CPU.** On a Ryzen 7 5800X (8c/16t) with 16GB RAM, an 8B Q4 model on CPU runs at roughly a few tokens/sec — a 4-stage council could take **many minutes per turn.**

This must be surfaced to the founder explicitly (a System Observatory "GPU acceleration: ACTIVE/CPU-FALLBACK" indicator) rather than discovered through mysterious slowness.

**What is realistic:**
- **Default models:** 7B–8B **Q4_K_M** quantized (≈4.5–5.5 GB) — fits 8GB VRAM with headroom **if** GPU offload works; otherwise CPU. The current `llama3.1:8b` default is reasonable; `qwen2.5:7b-instruct` is a good fast default.
- **One model resident at a time.** With 8GB VRAM you cannot hold multiple 8B models simultaneously — **sequential execution is mandatory** (already the case ✅). Expect model **swap** between agents if they use different models; keeping a shared 7–8B model for several agents reduces reload churn.
- **Embeddings:** `nomic-embed-text` (~275MB) is light and fine locally.
- **Context:** keep `num_ctx` modest (e.g. 4–8k) and `MAX_CONTEXT_CHUNKS=5`; large contexts blow up RAM/VRAM and latency.

**What must NOT be done on this hardware:**
- ❌ No 14B/32B/70B as default. `qwen2.5:14b` (~9GB Q4) **exceeds 8GB VRAM** → partial CPU offload, very slow → manual/optional only, behind a warning.
- ❌ No parallel multi-agent execution.
- ❌ No auto-pull of models (a single pull can be many GB).
- ❌ No assuming GPU acceleration — detect and report it.

**Current code vs this reality:** sequential ✅; 8B default ✅; but **no GPU/ROCm detection, no VRAM-fit warning, no missing-model handling, no per-agent model policy via env, no `num_ctx` tuning, no progress indicator for long turns.** Score 5/10 — right instincts, no guardrails.

---

## 13. GAP ANALYSIS vs THUNITY LOCAL AI COMPANY OS VISION

| Requirement | Current Status | Gap | Priority | Recommended Fix |
|---|---|---|---|---|
| `LOCAL_ONLY_MODE` enforcement | Absent | No flag, no blocking | **P0** | Add setting + guard that raises on any external adapter call; default `true`. |
| Quarantine Supabase / cloud | Dormant service + UI + config | Latent egress, promoted in UI | **P0** | Move to `adapters/optional/`, disabled, gated by `LOCAL_ONLY_MODE`; strip from core config/compose/desc; remove dashboard sync UI (Shot 3). |
| Secrets management | Default `SECRET_KEY`, committed `.env` | Forgeable JWT, secrets in repo | **P0** | Env-only secrets, no defaults; ship `.env.example` w/ `CHANGE_ME`; remove `.env` from artifact. |
| Auth (no hardcoded creds, hashing) | `admin/admin123` plaintext | Trivially bypassable | **P0** | DB-backed users + `passlib[bcrypt]`; remove `USERS_DB`. |
| Endpoint authz | Only `/me` protected | All endpoints open | **P0** | `get_current_user` dependency on every sensitive route; RBAC roles. |
| CORS | `*` + credentials | Insecure | **P0** | Read allowlist from env; no wildcard. |
| Upload safety | Path traversal | Escape `FILES_DIR` | **P0** | Route upload through `_safe_path`, validate ext+size, checksum, unique id. |
| Conversation/agent persistence | Models exist, **0 writes** | No memory | **P1** | Persistence service; write messages + `agent_runs`/`agent_messages`. |
| Migrations | None (drifting ORM/SQL) | Schema chaos | **P1** | Adopt Alembic; single source of truth; fix invalid SQL. |
| 4-agent council + evaluator | 3 agents, wrong domain prompts | Missing 2 roles + Thunity prompts | **P1** | Add Execution Engineer + Evaluator; rewrite prompts; contracts dir; prompt_versions. |
| Local knowledge base / RAG | None | No ingest/chunk/embed/retrieve/ground | **P1** | Local pipeline: parser + `nomic-embed-text` + pgvector/Chroma + `retrieve_context`. |
| Source grounding | None | Unverifiable answers | **P1** | Citations w/ chunk_id, relevance, trust; "no source used" notice. |
| Decision Ledger | None | AI output not durable | **P1** | `decisions` table + approve/reject/execute endpoints. |
| Task layer / Mission Board | None | No execution tracking | **P2** | `tasks` + from-decision endpoint. |
| Approval Gate | None | Risky actions ungated | **P1** | `approval_requests` + risk tiers + critical confirm phrase. |
| Tool Registry | None | No controlled tool use | **P2** | Registry w/ risk + permission + audit. |
| n8n governance | Free trigger, no logging | Ungoverned automation | **P2** | Allowlist registry + approval link + `workflow_runs`. |
| Evaluation layer | None | No quality signal | **P2** | `evaluations` + evaluator agent JSON rubric. |
| Observability APIs | Real but unstored | No history/trends | **P2** | Persist metrics + `/api/metrics/*` endpoints. |
| Audit log | None | Not auditable | **P1** | `audit_logs` for all sensitive events; append-only. |
| Backup / restore | None | Data-loss risk (once persisted) | **P2** | `backup-local.sh` / `restore-local.sh`, local-only, timestamped. |
| Hardware guardrails | Sequential ✅ only | No GPU/VRAM/model-availability warnings | **P1** | ROCm/CPU detection, VRAM-fit warning, missing-model manual command, env model policy. |
| Founder Command Center web | 2 static HTML pages + fake metrics | Not the product | **P3 (Shot 3)** | React/Tailwind OS shell; real-backend-only data; local-only badge. |
| Testing | None | No safety net | **P2** | pytest suite (local-only block, auth, persistence, ingestion, approval). |
| Docs (doctrine/compliance/hardware) | README + 1 guide | Vision undocumented | **P3** | `docs/OPERATING_DOCTRINE.md`, `LOCAL_ONLY_COMPLIANCE.md`, `HARDWARE_PROFILE.md`, `AGENT_COUNCIL.md`. |

---

## 14. MVP RECOMMENDATION

Aligned with the founder's own Section AP and build discipline ("don't add UI before backend is real").

**MVP — must ship (in this order of dependency):**
1. **Local-only enforcement** (`LOCAL_ONLY_MODE`, Supabase quarantined, `/api/health/local-only`).
2. **Security baseline** (env secrets, bcrypt + DB users, authz on all routes, CORS allowlist, safe upload).
3. **Real persistence** (migrations + conversation/message/agent_run writes).
4. **4-agent sequential council** (correct cast + Thunity prompts + Evaluator) with run logging.
5. **Local knowledge base (basic)** — ingest → chunk → local embed → retrieve → **source grounding**.
6. **Decision Ledger (basic)** — save synthesis as decision, approve/reject.
7. **Approval Gate (basic)** — high-risk actions require founder approval.
8. **Audit log (basic)** + **System Observatory data** (real, stored).
9. **Hardware guardrails** (GPU/CPU detection, model-availability, warnings).
10. **Then, and only then,** the **Founder Command Center web MVP** (Shot 3) on real endpoints — no dummy data.

**Defer (later phase):** Analytics Lab / Dataset Registry, Report Builder, Artifact Library, advanced Founder Inbox / Risk Register, Tool Registry for autonomous tool use, n8n auto-orchestration, client/project layer, sandbox runner, multi-user RBAC depth, deep-reasoning 14B path. Note each as a *later phase*, not now.

---

## 15. EXECUTION PLAN (phased)

Backend first (Shot 2), web later (Shot 3) — matching the founder's Section AQ.

| Phase | Focus | Shot |
|---|---|---|
| **1** | **Local-only compliance + security baseline** ← *next* | 2 |
| 2 | Migrations + real persistence (conversations, messages, agent_runs) | 2 |
| 3 | 4-agent council rebuild (cast, prompts, contracts, prompt_versions, run logging) | 2 |
| 4 | Local knowledge base / RAG (parse→chunk→embed→retrieve) | 2 |
| 5 | Source grounding + knowledge trust/lifecycle | 2 |
| 6 | Decision Ledger | 2 |
| 7 | Task layer / Mission Board | 2 |
| 8 | Approval Gate (+ wire to n8n/file-delete) | 2 |
| 9 | Tool Registry | 2 |
| 10 | n8n workflow governance (allowlist + workflow_runs) | 2 |
| 11 | Evaluation layer | 2 |
| 12 | Observability persistence + `/api/metrics/*` | 2 |
| 13 | Backup / restore scripts | 2 |
| 14 | pytest suite | 2 |
| 15 | Hardware guardrails (router, GPU/VRAM detection, warnings) | 2 |
| Web 1–15 | App shell → auth → Command Center → Council → Knowledge → Decisions → Mission → Approvals → Observatory → Audit → Settings → polish → docs | 3 |

(Phases 1–2 are the hard prerequisites; everything else builds on persistence + a safe perimeter.)

---

## 16. PHASE 1 — DETAILED PLAN (Local-only compliance + Security baseline)

**Objective:** Make the perimeter safe and the local-only promise *enforced*, without touching the web UI or large refactors. After Phase 1, the system must: (a) refuse external-AI/cloud calls when `LOCAL_ONLY_MODE=true`, (b) have no hardcoded credentials or default secrets, (c) authenticate every sensitive endpoint, (d) use a CORS allowlist, (e) block upload path traversal, and (f) expose `/api/health/local-only` with **real** data.

**Files likely to change (with reason):**

| File | Change | Why |
|---|---|---|
| `backend/config.py` | Add `LOCAL_ONLY_MODE`, `APP_ENV`, `ALLOWED_ORIGINS`, full `OLLAMA_MODEL_*` set, `MAX_UPLOAD_MB`, `JWT_EXPIRE_MINUTES`; remove default `SECRET_KEY` (require from env); move `SUPABASE_*` out of core. | Central, env-driven, local-only-aware config. |
| `.env.example` | Rewrite to the founder's local-only target; `CHANGE_ME` placeholders; **no** `OPENAI_API_KEY`/`SUPABASE_KEY`. | Safe template; no cloud residue. |
| `.env` (artifact) | Remove from deliverable / gitignore. | Secrets must not ship. |
| `backend/main.py` | CORS from `ALLOWED_ORIGINS` (no `*`); remove **duplicate** `/chatbot` route; drop "Supabase" from description; call local-only guard on startup. | Fix S3 + dedupe + compliance. |
| `backend/api/routes/auth.py` | Remove `USERS_DB`; authenticate against DB users with `passlib[bcrypt]`; keep JWT but secret from env; add `get_current_user` + role check dependency. | Fix S1, S2, S4. |
| `backend/core/security.py` *(new)* | `get_current_user`, `require_role`, password hashing helpers. | Reusable authz. |
| `backend/core/local_only.py` *(new)* | `assert_local_only()` guard + registry of "external" adapters; raises `External AI provider calls are disabled in LOCAL_ONLY_MODE.` | Real enforcement (Section C). |
| `backend/adapters/optional/supabase_sync.py` *(moved)* | Relocate `services/supabase_sync.py`; gate every method behind `assert_local_only()`; disabled by default. | Quarantine latent egress. |
| `backend/api/routes/files.py` | Route `/upload` through `_safe_path`; validate extension + `MAX_UPLOAD_MB`; add checksum + unique id; require auth. | Fix S5. |
| `backend/api/routes/{agents,metrics,n8n_webhooks,conversations,files}.py` | Add auth dependency to sensitive endpoints. | Fix S4. |
| `backend/api/routes/health.py` *(new)* | `GET /api/health/local-only` returning real compliance object. | Section D. |
| `backend/services/database.py` | Add `User` model + seed-first-founder helper (used by auth); keep create_all for now (Alembic in Phase 2). | Back DB auth. |
| `docker-compose.yml` | Remove default secret values (require from env); keep services local; (optionally) bind infra ports to 127.0.0.1. | Fix S7/S8/S10. |
| `backend/requirements.txt` | Add `passlib[bcrypt]`, `bcrypt`, `python-dotenv` (and `pytest`, `pytest-asyncio` for the test step). | Hashing + tests. |
| `backend/tests/test_phase1.py` *(new)* | Phase 1 tests (below). | Verification. |

**Steps (sequential, small commits):**
1. Add `LOCAL_ONLY_MODE` + config hardening; create `core/local_only.py`.
2. Quarantine Supabase into `adapters/optional/`, gate behind the guard; strip from core config/compose/description.
3. Replace auth: DB users + bcrypt; delete `USERS_DB`; secret from env (fail fast if missing in non-dev).
4. Add `get_current_user`/`require_role`; apply to all sensitive routes.
5. Fix CORS to allowlist; remove duplicate `/chatbot` route.
6. Harden `/upload` (safe path, ext/size, checksum, id).
7. Add `GET /api/health/local-only` with real probes.
8. Write + run the Phase 1 pytest suite.

**Risks & mitigations:**
- *Auth swap could lock out access* → seed a first founder via env-provided credentials on startup; document the bootstrap.
- *Existing static frontends call open endpoints* → they will start getting 401; acceptable for Shot 2 (web is Shot 3), but note it so it's not a surprise. Provide a documented token flow.
- *Requiring `SECRET_KEY` from env may break `docker compose up`* → keep a clearly-labeled dev fallback only when `APP_ENV=development`, never in prod.
- *Moving Supabase file* → it's dead code (no imports), so move is low-risk; verify with a grep after.
- All changes are perimeter/config — **no schema migration, no UI, no data deletion** in Phase 1.

**Test plan (after Phase 1):**
- `LOCAL_ONLY_MODE=true` → any call into the optional Supabase adapter raises the disabled-provider error.
- `GET /api/health/local-only` returns `local_only_mode: true`, `external_ai_providers_enabled: false`, real Ollama/DB/n8n status.
- Login with old `admin/admin123` **fails**; login with seeded founder (bcrypt) succeeds; JWT verified with env secret.
- Calling `/api/agents/chat/stream`, `/api/files/*`, `/api/n8n/trigger` **without** a token → 401.
- Upload with `filename="../../evil.txt"` → rejected/normalized inside `FILES_DIR`; oversized/disallowed ext → rejected.
- CORS: request from a non-allowlisted origin is not granted credentials; no `*` in response.
- `grep -ri "admin123\|supersecret\|USERS_DB"` over `backend/` → no live hits.

**Expected result:** A backend that *enforces* local-only, has no hardcoded credentials or default secrets, authenticates all sensitive endpoints, rejects path-traversal uploads, exposes a real `/api/health/local-only`, and quarantines the only cloud adapter — with a passing Phase 1 test suite. **No new product features, no UI, no large migrations.** This squarely supports priorities #1 (100% local core) and #2 (secure by default), is more auditable, and is fully realistic for the RX 6600 XT / 16GB target (perimeter work, zero added model load).

> Per your discipline rule, when I implement Phase 1 in Shot 2 I will report for each change: file changed · why · risk · how to test · supports-local-core? · more-secure? · more-auditable? · realistic-for-hardware?

---

## 17. STOP POINT

This concludes the Shot 1 audit and the Phase 1 plan. No large implementation was performed; the codebase was only read and analyzed (extracted to a scratch copy — your original `ai-ecosystem.zip` is untouched).

**Saya siap lanjut ke Shot 2 setelah Anda approve audit dan Phase 1 plan.**
