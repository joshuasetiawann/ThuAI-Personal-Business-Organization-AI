# Operating Doctrine

**Core promise: your company brain stays on your machine.**

Thunity Local AI Company OS is a private, local-first AI operating system for company
intelligence, decision-making, knowledge management, task execution, and workflow
governance. This document states the non-negotiable principles every part of the
backend is built to uphold. Where reality falls short of an ideal, the limitation is
stated honestly rather than hidden.

## Principles

**1. Local-first, honest hybrid (updated 2026-06-06).** Reasoning runs on local Ollama
models by default, and all embeddings and data always stay on the machine. For heavy or
strategic work a SINGLE founder-DECLARED, key-gated frontier provider (Anthropic or
OpenRouter) may be used — gated by `assert_frontier_allowed()` (`core/local_only.py`),
always LABELLED to the founder per answer, with NO silent cloud fallback. With no frontier
key configured the system runs 100% locally. When `LOCAL_ONLY_MODE` strict mode is set (or
no key is present), every external call is blocked, raises `ExternalProviderBlocked`, and
is audited. No OpenAI / Gemini / Groq / Supabase / Pinecone / Weaviate path exists in the
core — only the one declared frontier lane. `compliance_status()` reports `compliant`
(fully local) or `hybrid` (local + declared frontier) truthfully. See `LOCAL_ONLY_COMPLIANCE.md`.

**2. Local infrastructure only.** PostgreSQL, Redis, and n8n all run on the founder's
machine via `docker-compose.yml`, bound to `127.0.0.1`. n8n is local automation, never
a cloud brain. Inference is local Ollama only.

**3. Hardware humility.** The target machine is a Radeon RX 6600 XT (8GB VRAM), Ryzen 7
5800X, and 16GB RAM. The default model policy is 7B/8B quantized models. A heavier 14B
"deep reasoning" model exists but is opt-in/manual and never auto-selected. Agents run
**sequentially** (`AGENT_EXECUTION_MODE=sequential`, `MAX_PARALLEL_AGENT_RUNS=1`) to
respect 8GB VRAM. See `HARDWARE_PROFILE.md`.

**4. Human governance over high-risk action.** The AI proposes; humans decide. High and
critical-risk actions require founder/admin approval, and critical actions require a
typed confirmation phrase. The AI never self-approves a risky action. See
`DECISION_TASK_APPROVAL.md` and `WORKFLOW_TOOL_GOVERNANCE.md`.

**5. Auditability and decision traceability.** Every council run, tool call, workflow
trigger, approval, login, and blocked attempt is persisted. Decisions link back to the
conversation, the agent run, and the evidence/sources that produced them. The audit
trail is read-only via the API (no delete route). Secrets are never logged.

**6. Honesty over false success.** Failures are recorded as failures (e.g. Ollama
offline → stage `failed`; unbound tool → `not_implemented`; workflow → `skipped`/
`failed`). The system never fakes a successful result.

**7. Grounded answers.** When the knowledge base is used, sources are cited with a trust
level; when no source is used, the answer says so. Low-trust sources carry a warning.

## Scope boundary

This repository is the **Shot 2 backend**. The Founder Command Center frontend is
intentionally **Shot 3** and is not built here. This session prepares Sprint 9
documentation and readiness; it does not start Shot 3 and does not modify backend code.

## The decision contract

The Executive Synthesizer (final council stage) must always answer with the same
labelled sections, including **LOCAL-ONLY COMPLIANCE** (does the plan keep the brain
fully local?) and **HARDWARE FIT** (is it realistic on RX 6600 XT 8GB + 16GB RAM?).
The doctrine is therefore enforced at the prompt level, not just in code.

## UI safety rule (Shot 3)

High-risk actions are never one-click. The UI must require explicit confirmation and route
through the approval gate (`202 approval_required`); critical actions additionally require
the confirmation phrase. The web layer may *surface* these flows but must never bypass the
backend's approval checks.
