# Thunity — Brand & UI Guide

Single source of truth for Thunity's visual direction. Read this before any UI change.
The attached logo and UI-mockup images are **design direction, not pixel truth** — follow
the intent (matte premium local-AI OS), never copy artifacts/typos.

> Device rule: this guide and all UI work live on Acung's MacBook repo only; Joshua's
> demo PC sees nothing until a clean ZIP is packaged and applied.

## 1. Product Identity
Thunity Local AI Company OS — a premium, local-first AI **operating system / Founder
Command Center**. Your company brain stays on your machine. It unifies a fast local
assistant, a deliberative AI Council, knowledge, decisions, tasks, approvals, workflows,
tools, audit, and observability — all local-only.

## 2. Brand Personality
Premium · local-first · private · founder-controlled · serious · intelligent · precise ·
matte dark · secure · modern AI-native.
**Not:** generic SaaS, cyberpunk, hacker terminal, gaming/crypto, chrome/metallic/neon,
glossy, or playful-chatbot.

## 3. Visual References Summary
- **Logo reference:** an interlocked **Thunity monogram** (geometric T + circular/phi
  forms) plus the **THUNITY** wordmark; works white-on-matte-black and black-on-white;
  scales to favicon/app-icon; supports a very low-opacity background watermark.
- **UI reference:** matte near-black product; **left sidebar** nav with monogram + THUNITY
  header; **central chat** ("Main Chat" / Fast Chat) as the hero; **right Founder Insight
  / System Status panel** (Backend/Database/Ollama/n8n online, Founder Context, Recent
  Decisions, Pending Approvals, Local Vault); top bar shows **STATUS: Local-Secure** and
  **Model: Local Fast**; a **Fast Chat ⇄ AI Council** toggle; quiet suggestion chips; low-
  radius cards; subtle borders; calm hierarchy; a faint centered monogram watermark.

## 4. Final Color Palette — "Stealth Slate & Phosphor"
| Token | Hex | Use |
|---|---|---|
| Background | `#090A0C` | app base |
| Elevated surface | `#13151A` | raised areas / topbar |
| Card / panel surface | `#1C1F26` | cards, panels, drawers |
| Sidebar surface | `#0D0F12` | left nav |
| Border / divider | `#2D313A` | hairlines, separators |
| Primary text | `#EDEDF0` | body text |
| Muted text | `#9BA1A6` | labels, metadata |
| Primary AI accent | `#4F67FF` | AI actions, active nav, focus |
| Local/secure accent | `#00D4B2` | local/private/secure/online status |
| Success | `#34D399` | success states |
| Warning | `#FBBF24` | warnings |
| Danger | `#F87171` | failure/destructive |

(Current `index.css` already uses bg/panel/line/text/muted/accent/ok/warn/bad from this
set. Sidebar `#0D0F12` and the `#00D4B2` local-secure accent are **new** tokens to add
when the next visual sprint runs — not in this docs-only task.)

## 5. Color Usage Rules
- Dark surfaces dominate (~85% of the UI); avoid colorful dashboards.
- `#4F67FF` (AI accent) **sparingly** — primary actions, active nav, focus rings, AI emphasis.
- `#00D4B2` (phosphor) **only** for local/private/secure/online status (e.g. "Local-Secure", service "Online").
- Red `#F87171` **only** for danger/failure/destructive.
- No neon, no chrome/metallic gradients, no glassmorphism overload, no heavy shadows.

## 6. Typography Rules
- UI font: modern neo-grotesque (Inter / SF Pro / Geist feel). Clean, legible, premium.
- Monospace **only** for: IDs, latency, model names, status codes, audit log values, metadata.
- No sci-fi / gaming / display typography for UI text. The `THUNITY` wordmark may be
  uppercase with slight letter-spacing (existing `.brand-wordmark`).

## 7. Logo Usage Rules
- Preserve the **Thunity monogram** identity from the reference; wordmark is exactly **THUNITY**.
- Never substitute a cube/shield/generic AI glyph or redesign the logo in frontend code.
- Repo has **no clean logo asset yet** (current mark is a placeholder `◆`). When Acung
  provides real artwork, future asset paths:
  - `frontend/public/thunity-logo.svg` (sidebar/login lockup)
  - `frontend/public/favicon.svg` (browser/app icon)
- Wire the real asset **only** when provided; until then keep the typographic `THUNITY`.

## 8. UI Surface / Radius / Shadow Rules
- Radius: low and precise — **≤ 8px** for cards/inputs/buttons; pills only for small chips/badges.
- Borders: 1px hairlines using the border token; prefer borders over shadows.
- Shadows: minimal/matte (a faint top highlight at most); no large soft drop shadows.
- Spacing: generous and consistent; card-based layout; calm hierarchy.
- Three-zone feel: **sidebar · center · right insight panel** where it fits.

## 9. Fast Chat vs AI Council UX Rules
- **Fast Chat** = default quick local assistant (the central "Main Chat"). One local model,
  fast answers. Shows **Local-only · No tools · No workflow execution**.
- Fast Chat must **never** create decisions, tasks, approvals, workflows, or tool calls.
- **AI Council** = deeper strategic mode (6-stage deliberation, slower).
- **Save Draft Decision / Create Task** remain **Council-only**.
- **Use Knowledge Base** remains **Council-only** (unless explicitly changed later).
- **Escalate to AI Council** may switch mode + fill a prompt but **must not auto-submit**.
- Honest states everywhere: pending stays pending, errors stay errors, no fake success.

## 10. Page-Level Application Notes
- **Login** — centered card on matte radial-dark; monogram + `THUNITY` + "Local Secure Login"; phosphor accent for the secure cue; no chrome.
- **AppShell / sidebar / topbar** — sidebar surface `#0D0F12`; monogram + THUNITY header; active nav uses AI accent; topbar shows **Local-Secure** (phosphor) + current model (mono) + role.
- **Fast Chat (Main Chat)** — hero center column; You / Thunity Assistant turns; quiet suggestion chips; status chips; faint monogram watermark allowed (very low opacity).
- **AI Council** — clearly distinct from Fast Chat; stage timeline, synthesis (contract headers), evaluation bars, transcript; Save-Decision/Create-Task actions only here.
- **Dashboard** — Founder Daily Briefing (attention items) + compact status; phosphor for compliant/online, warning/danger used sparingly.
- **Knowledge Vault** — document table with trust/status badges; upload panel; search with grounding; trust levels are labels, not verification.
- **Decisions** — ledger table + detail drawer; risk badges; execute is status+audit only, approval-gated.
- **Tasks** — mission board table; status/priority/risk badges; from-decision link.
- **Approvals** — governance queue; founder/admin resolve; critical needs confirmation phrase; resolve updates status only.
- **Workflows** — allow-list; low/medium trigger only; high-risk disabled/approval-gated; honest run statuses.
- **Tools Registry** — display-only (name/risk/permission/audit/schema); no execute UI.
- **Audit Trail** — append-only; mono for ids/metadata; entity deep-links where targets exist.
- **Observatory** — services/hardware/models/workflow-runs; online uses phosphor; CPU-fallback/missing-model shown honestly.
- **Settings** — read-only governance/system mode; local-only explanation; n8n/webhook guidance; no secrets, no mutation.

## 11. What To Avoid
Generic SaaS dashboards, cyberpunk/neon, hacker-terminal green-on-black, gaming/crypto
styling, chrome/metallic/glossy/glassmorphism, heavy shadows, colorful KPI clutter, fake
data, fake success, redesigned/invented logos, typo'd wordmarks, and over-strong watermarks.

## 12. Instructions For Future Claude Tasks
- **Read this guide before any UI change.**
- Work in **micro-tasks** with **exact file scopes** (one or few files per task).
- **Do not redesign the logo**; only wire the real asset when Acung provides it.
- **Do not touch** backend / models / Ollama / Docker / Postgres / n8n / volumes; never suggest model pull/reinstall/download.
- **Do not add execution paths** (tool execute, high-risk workflow trigger, destructive doc actions).
- **Preserve Fast Chat / AI Council safety boundaries** (Fast Chat has no side-effects; Save-Decision/Create-Task/Knowledge-Base stay Council-only; no auto-submit on escalate).
- Use the attached images as **direction, not exact copy**; keep matte, precise, premium.
- Verify every code task with `cd frontend && npm run build` (clear `frontend/dist` first in the sandbox).
