# Post-Demo Feedback — Joshua

**Context:** Joshua reviewed the local Thunity demo (full local stack: backend + Ollama + Postgres + n8n + Vite frontend). Verdict: enough to show real progress.

## What worked
- Login + local stack came up; database online.
- Dashboard / Founder Daily Briefing.
- AI Council page (4 agents + evaluator, local).
- Workflows Lite (allow-listed low/medium trigger).
- Tools Registry (display-only).
- Approval Gate (resolve flow).

## What was confusing
- **Approval Gate when empty** — "kalau mau request gimana caranya?" It wasn't clear that approval requests are created *automatically* by gated high-risk actions, not manually. (Addressed: added a "How approval requests are created" help box on the Approvals page.)
- **Settings was a stub** — Joshua wanted a real Settings page incl. n8n configuration + webhook explanation. (Addressed: Settings is now a real read-only page.)
- **AI Council felt slow / responses a bit random** for trivial input (e.g. "halo") — running the full 6-stage council for small talk feels heavy and not chatbot-like.
- **Local process / database visibility** — wants clearer insight into what's running locally.
- **Some statuses/warnings need plainer explanation** (e.g. GPU acceleration "unconfirmed", workflow "failed").

## Joshua requested
- A more **chatbot-like** flow that feels useful for everyday questions.
- **Previous chat / memory visibility** (easier access to past conversations).
- A **share-screen** concept (later).
- **Settings** for n8n / webhook configuration.

## Product direction (agreed)
- Next work should be **observability + deep-link + chat/memory UX polish** — not destructive features.
- Make the AI Council feel **purposeful**: don't run the full adversarial council for trivial chat; consider a lightweight single-agent path for small talk later.
- Keep **workflow/tool high-risk execution disabled** until the approval→action handoff is mature.
- Keep **failed/skipped honest** — never fake success.

## Notes on hardware
- GPU acceleration shows "unconfirmed" — needs investigation (RX 6600 XT / gfx1032 + Ollama ROCm). Not a blocker; surfaced honestly as a CPU-fallback warning.
