# Thunity — Workspace Consolidation (W18A)

**Date:** 2026-06-05 · **Type:** safe, non-destructive workspace organization (no code/UI changes).

This document ends the multi-folder confusion. Read it first if you are unsure
which folder is the real Thunity project.

---

## 1. The ONE official Thunity repo

```
/Users/aaa/Documents/Claude/Projects/PROJECT AI COMPANY/thunity-ai
```

This is the only active Thunity working folder. It holds the latest **W17**
frontend (verified: `chat-cockpit`, `Recent Conversations`, `Local-Secure`,
`Model: Local Fast`, consolidated `index.css`) plus the backend, scripts, and docs.

### Do NOT use these as the active repo
- `/Users/aaa/Documents/Claude/Projects/PROJECT AI BUILDING` — **references/assets only** (see below). Not code.
- `/Users/aaa/Projects/thunity-ai` — old/stray working copy. Do not use unless explicitly told later.
- Any `*.zip` (e.g. `Salinan PROJECT AI COMPANY 5.zip`, `PROJECT AI COMPANY.zip`) — old snapshots/backups.

### Not touched (separate project)
- `/Users/aaa/Documents/Claude/Projects/THUWEALTH AI` — **excluded entirely.** Confirmed it exists; nothing was read, copied, moved, or modified.

---

## 2. What was imported (from PROJECT AI BUILDING → official repo)

### Visual references → `references/`
| Source (PROJECT AI BUILDING) | Imported to | What it is |
|---|---|---|
| `9ce38642-…​.jpeg` | `references/visual/thunity-target-chat-mockup_9ce38642.jpeg` | **Approved target /chat mockup** (frontier UI) |
| `0c109365-…​.jpeg` | `references/brand/thunity-brand-sheet-final-direction-review_0c109365.jpeg` | Brand identity sheet (monogram, lockups, favicon previews) |
| `afbf3c75-…​.jpeg` | `references/brand/thunity-brand-sheet-refinement-extensions_afbf3c75.jpeg` | Brand identity sheet (refinement & extensions) |

> These are **raster reference sheets/mockups**, not production logo assets — see §4.

### Claude handoff / planning materials → `docs/claude-code/`
- `docs/claude-code/imported-sprint9-prep/` — the full `thunity-sprint9-prep/` bundle, imported verbatim under a preserved namespace so it **does not overwrite** the newer official `docs/`. Contains:
  - `handoff/` — `MAIN_CLAUDE_APPLY_PROMPT.yaml`, `MAIN_CLAUDE_CONTINUATION_PROMPT.md`, `HANDOFF.md`, `FINAL_HANDOFF.md`, `GEMINI_FINAL_QA_PROMPT.md`, `GROK_FINAL_REDTEAM_PROMPT.md`, `MISSING_TESTS_PLAN.md`
  - `reviews/` — backend readiness, QA, red-team, missing-tests checklists
  - `shot3-plan/` — SHOT3 web plan + W2/W4/W4.2/W6.3 page plans
  - `docs/` — older copies of architecture/API/RAG/etc. (newer versions already live in the official `docs/`)

### Claude Max onboarding → `docs/claude-max/`
Extracted from `thunity_claude_max_onboarding_files.zip` (4 files):
`CLAUDE_MAX_START_HERE.md`, `UI_REFERENCE_RULES.md`,
`CLAUDE_MAX_FIRST_TASK_ORIENTATION.md`, `README_THUNITY_CLAUDE_MAX_PACKAGE.md`.

---

## 3. What was skipped (left in place, NOT imported)
- **`Salinan PROJECT AI COMPANY 5.zip`** (411 KB) — an old *full-project copy*. Its `thunity-ai/backend/` snapshot is **older** than the official repo's backend, so that code was **not** imported (avoids reintroducing stale code). The zip itself was left untouched in PROJECT AI BUILDING. **However**, a deeper re-check (after W18A's first pass) found two *unique historical* items inside it that did **not** exist anywhere in the official repo — these were rescued into `references/archive/` (see §3a) so nothing important lives only inside a loose backup zip.

### 3a. Rescued from inside `Salinan…zip` → `references/archive/`
| Item | Archived as | What it is |
|---|---|---|
| `SHOT1-AUDIT-Thunity-Local-AI-Company-OS.md` (37 KB) | `references/archive/SHOT1-AUDIT-Thunity-Local-AI-Company-OS.md` | AI Council audit report (2026-06-01) of the original prototype — historical record |
| `ai-ecosystem.zip` (150 KB) | `references/archive/ai-ecosystem_predecessor-prototype.zip` | The **predecessor codebase** ("AI Ecosystem") Thunity was rebuilt from — kept as a zip, **not** extracted/merged (it is not current Thunity code) |

The rest of the `Salinan…zip` (older `backend/` snapshot, `.pyc`/`__pycache__`/`__MACOSX`/`.DS_Store` cruft) was correctly skipped.
- `*.zip` at the Projects root (`PROJECT AI BUILDING.zip`, `PROJECT AI COMPANY.zip`) — backups, left alone.
- `.DS_Store` files — macOS cruft, not imported (removed only from our own copy of the imported bundle).
- Anything related to Atomy / agency / media / THUWEALTH — none present in scope; nothing merged.

---

## 4. Logo asset status (honest)
**No production logo asset (SVG/PNG) was found.** PROJECT AI BUILDING only had
raster brand *sheets* (now in `references/brand/`). Therefore:
- `frontend/public/brand/` was created but is **empty** (see its README for where to drop real assets).
- The W17 logo-ready slots still fall back to the ◆ placeholder — nothing was faked or hand-traced.
- To wire the real logo later: drop `thunity-mark.svg` / `thunity-logo.svg` / `favicon.svg` into
  `frontend/public/` (root). The slots in `AppShell.tsx`, `Login.tsx`, `Council.tsx`, and
  `index.html` already point there. (That is Bundle D — not part of W18A.)

---

## 5. Where things live now
- **Visual references:** `references/visual/` (target mockup), `references/brand/` (brand sheets), `references/current-ui/` (empty — current screenshots live in `~/Documents/MOCKUP`, outside scope).
- **Claude Code handoffs / plans:** `docs/claude-code/`
- **Claude Max onboarding:** `docs/claude-max/`
- **Live product/UI docs:** the official `docs/` (e.g. `W14_UI_UX_HANDOFF.md` with W14–W17 notes, `THUNITY_BRAND_UI_GUIDE.md`, `LOCAL_DEV_RUNBOOK.md`).

---

## 6. What must NOT be used anymore
- PROJECT AI BUILDING as an *active code repo* (it is references-only now).
- `/Users/aaa/Projects/thunity-ai` (stray copy).
- Any old `*.zip` snapshot as a source of truth.

---

## 7. Recommended next UI task
The frontend is at **W17** (frontier /chat, consolidated CSS, real-data Founder
Insight panel). The natural next step is **Bundle D**: export and drop the real
THUNITY logo SVGs into `frontend/public/` so the existing logo-ready slots render
the real monogram (replacing ◆) — using the brand sheets in `references/brand/` as
the source of truth. After that, a light pass applying the W17 card language to the
remaining data pages (Tools/Workflows/Observatory).
