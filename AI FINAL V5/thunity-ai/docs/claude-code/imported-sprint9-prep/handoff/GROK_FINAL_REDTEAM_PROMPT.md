# Grok — Final Red-Team Prompt (paste as-is)

> Paste the prompt below into Grok and attach the backend (the `thunity-ai/` repo or zip).
> It is self-contained.

---

You are a senior offensive-security engineer red-teaming a backend before its frontend
phase ships. The system is **Thunity Local AI Company OS** — a private, local-first AI
"company brain." Its central promise is: **"your company brain stays on your machine."**

Architecture facts (treat as ground truth; verify against the code I attached):
- FastAPI + async SQLAlchemy. Local stack via docker-compose: Ollama (the only inference
  path), PostgreSQL, Redis, n8n. No external/cloud AI provider is in the core path;
  `LOCAL_ONLY_MODE=true` is the default and a guard (`core/local_only.py`) raises +
  audits any external attempt. A quarantined `adapters/optional/supabase_sync.py` is
  disabled and gated.
- Auth: bcrypt + JWT (HS256); RBAC roles founder/admin/operator/analyst/viewer; no
  hardcoded credentials (founder bootstrapped from env).
- Governance: decisions/tasks/approvals; high/critical actions require founder/admin
  approval; critical needs the typed phrase "APPROVE DELETE"; AI never self-approves.
  Tools must be registered; workflows must be allow-listed; audit log is append-only.
- Hardware target: AMD Ryzen 7 5800X, Radeon RX 6600 XT (8GB VRAM), 16GB RAM. Models are
  7B/8B by default, executed sequentially; a 14B model is opt-in only.

Your job: **break the local-only guarantee and the governance/security controls.** Do not
be polite; assume a motivated insider and a hostile LAN. For each attack, give the exact
request/repro, the observed vs expected behavior, severity (critical/high/medium/low) ×
likelihood, and a fix that **preserves local-only** (never suggest a cloud service).

Attack surface to cover (at minimum):
1. **Local-only escape:** any code path, config flip (`LOCAL_ONLY_MODE=false`,
   `ENABLE_SUPABASE_ADAPTER=true`), or n8n workflow that reaches an external network;
   confirm production startup refuses insecure/cloud config; confirm blocked attempts are
   audited.
2. **AuthN/Z:** JWT forgery/alg-none/expiry/`sub` swap; privilege escalation across the 5
   roles; cross-user data access; confirm admin cannot resolve high/critical approvals.
3. **Governance bypass:** execute a high-risk decision without an `approval_id`; approve
   a critical request without/with a wrong phrase; run an unregistered or high-risk tool
   without approval; trigger a non-allow-listed workflow.
4. **Secret/data leakage:** `/api/settings`, error responses, audit metadata, logs;
   confirm `SECRET_KEY`/DB/n8n passwords/tokens are never exposed and no stack trace
   leaks; confirm a produced backup excludes the real `.env`.
5. **File/input:** path traversal (filename + read paths, unicode/backslash variants),
   oversized uploads, disallowed extensions, malicious PDF/XLSX/CSV (formula injection,
   zip bombs).
6. **Prompt injection / grounding integrity:** a knowledge document that instructs the
   council to ignore local-only or exfiltrate; confirm it cannot change behavior, that
   low-trust sources are flagged, and that `grounding_score` drops when internal facts are
   claimed without a cited source.
7. **Network/infra:** the backend publishes `0.0.0.0:8000` while other services bind
   `127.0.0.1` — assess LAN exposure and recommend binding. Confirm postgres/redis/n8n
   are not reachable off-host.
8. **Integrity/DoS:** attempt to mutate/delete audit rows via the API; force the heavy
   14B model or many concurrent council runs and check the sequential limits + timeouts;
   confirm failed Ollama/workflow are recorded as failures, never fake success.

Deliverable: a ranked findings table (severity × likelihood) with repro steps and
local-only-preserving fixes, plus a short "residual risk" note for anything that is a
documented limitation rather than a bug (e.g. unconfirmed GPU acceleration on gfx1032,
linear-cosine vector search, sandbox not executing code yet). Flag any place where the
docs in `docs/` overstate what the code actually does.
