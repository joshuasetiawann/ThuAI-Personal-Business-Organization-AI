# UI REFERENCE RULES — THUNITY AI

The uploaded UI/UX references, color palette, and logo assets are guidance, not permission to redesign broadly.

## How to Use References

Use references to understand:
- premium matte dark feel
- quiet hierarchy
- precise spacing
- strong but calm contrast
- founder-grade seriousness
- modern software confidence
- local/private/security cues

Do not copy references directly unless Acung explicitly asks.

## Thunity Visual Direction

Thunity should feel like:
- Local AI Company OS
- private AI operations command center
- serious founder-grade product
- matte dark interface
- precise and controlled
- trustworthy
- operational, not decorative

Thunity should not feel like:
- generic admin dashboard
- crypto app
- cyberpunk UI
- neon-heavy interface
- glassmorphism/chrome toy
- AI gimmick landing page
- random SaaS template
- MLM/business-poster style
- over-designed Dribbble mockup

## Color Direction

Current core direction:
- dark matte slate background
- elevated panels
- low-radius cards
- clean white/gray text
- controlled blue accent
- local/private secure accent: `#00D4B2`

Use `#00D4B2` only for local/private/security cues. Do not turn it into the main brand color everywhere.

## Logo Rules

If a real logo asset is provided:
- Use the provided asset.
- Do not invent a new logo.
- Do not redesign the logo.
- Do not change the wordmark text.
- Wordmark must say exactly: `THUNITY`.

Recommended eventual asset paths:
- `frontend/public/thunity-logo.svg`
- `frontend/public/favicon.svg`

Logo wiring should be a specific task, not part of a broad UI polish.

## UI Work Rules

Before visual implementation:
1. Run a read-only scout.
2. Identify exact files.
3. Propose one small patch or one-domain bundle.
4. Do not redesign all pages.
5. Do not touch backend/API/Docker/model systems.
6. Build after implementation.
7. Mark visual QA as pending unless screenshots/browser check are performed.

## Current QA Gate

Before more Fast Chat or AI Council polish:
Run W14N Manual QA Checklist.

Check:
- `/dashboard`
- `/chat`
- `/council`
- Login

Score with:
- brand alignment
- premium feel
- functional clarity
- mode clarity
- safety clarity
- visual hierarchy
- noise control
- trust

## Patch Discipline

Preferred visual task size:
- Tiny: 1 file / 1 visible change
- Small: 1–3 files
- Full Safe Bundle: one domain only, exact files, 15–25%

Forbidden vague tasks:
- “fix UI”
- “make it better”
- “redesign everything”
- “study the project”
- “clean all files”
- “continue”

## Product Trust Rules

No UI should imply:
- a decision was created when it was only recommended
- a task was created before explicit confirmation
- a workflow ran when nothing executed
- model/backend/database health is live when it is not verified
- external AI was used when it was not
- local/private safety beyond what the system actually guarantees

Always distinguish:
- draft
- recommendation
- pending
- failed
- created record
- executed action
- needs approval
