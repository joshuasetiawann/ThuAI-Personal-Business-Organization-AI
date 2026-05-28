# Grok Red-Team Checklist (after Sprint 9)

Adversarial review. Goal: break the core promise — "your company brain stays on your
machine" — and the governance guarantees. Assume a motivated insider and a hostile
network. For each item: attempt it, expect the listed defense, report any gap.

## Local-only / data sovereignty
- [ ] Flip `LOCAL_ONLY_MODE=false` + `ENABLE_SUPABASE_ADAPTER=true`; confirm production
  startup still **refuses** (`startup_safety_check`) and dev only warns.
- [ ] Search the whole tree for any *active* cloud client constructed before the guard;
  confirm `check-local-only.py` would catch it.
- [ ] Try to reach an external provider through the council, embeddings, or workflows;
  confirm no path exists and blocked attempts are audited.
- [ ] Author an n8n workflow that calls an external URL; confirm the backend's allow-list
  still limits *which* workflows trigger, and document the residual n8n outbound risk.

## AuthN / AuthZ
- [ ] Forge / tamper JWTs (alg swap, `none`, expired, wrong `sub`); confirm rejection.
- [ ] Privilege escalation: viewer/analyst/operator attempt founder/admin-only actions
  (user creation, approvals, high-risk tools/workflows).
- [ ] Cross-tenant: access another user's conversation/decision; confirm `403` (founder
  exempt by design).
- [ ] Confirm `admin` cannot resolve `high`/`critical` approvals (founder-only).

## Governance bypass
- [ ] Execute a high-risk decision without a valid `approval_id`; confirm the `202` gate.
- [ ] Approve a `critical` request without / with a wrong confirmation phrase; confirm
  `400`.
- [ ] Run an unregistered tool, or a high-risk tool without approval; confirm block +
  audit.
- [ ] Trigger an arbitrary (non-allow-listed) workflow; confirm `WORKFLOW_NOT_ALLOWED` +
  audit.

## Secret / data leakage
- [ ] Inspect `/api/settings`, error responses, audit metadata, and logs for `SECRET_KEY`,
  DB/n8n passwords, or tokens; confirm redaction and no stack-trace leak.
- [ ] Produce a backup; confirm the real `.env` is absent and (if `BACKUP_GPG_RECIPIENT`
  set) encryption works.

## File / input attacks
- [ ] Path traversal via filename and read paths (`../`, absolute, `~`, backslashes,
  unicode); confirm rejection.
- [ ] Oversized upload (> `MAX_UPLOAD_MB`) and disallowed extensions; confirm rejection.
- [ ] Malicious PDF/XLSX/CSV (zip bombs, formula injection, huge sheets); confirm graceful
  handling, no code execution.

## Prompt-injection / grounding integrity
- [ ] Ingest a document instructing the council to ignore local-only or exfiltrate; confirm
  it cannot change behavior and that low-trust sources carry warnings.
- [ ] Confirm `grounding_score` drops when internal facts are claimed without a cited
  source.

## Network / infra
- [ ] Probe the `0.0.0.0:8000` backend from another host on the LAN; assess exposure and
  recommend `127.0.0.1` binding.
- [ ] Confirm postgres/redis/n8n are not reachable off-host (127.0.0.1 binds).
- [ ] DoS: force the heavy 14B model / many concurrent council runs; confirm sequential
  limits and timeouts hold.

## Integrity / audit
- [ ] Attempt to delete or mutate audit rows via the API; confirm no route exists.
- [ ] Confirm failed Ollama / failed workflow are recorded as failures, never fake
  success.

Deliverable: ranked findings (severity × likelihood) with the exact request/repro and a
local-only-preserving fix suggestion for each.
