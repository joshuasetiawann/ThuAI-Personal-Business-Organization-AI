# W14 UI/UX — Night Handoff & Tomorrow QA Runbook

## 1. Current W14 Status
Thunity is technically demo-stable. Completed and reviewed:
- **W13A Fast Chat** — `/api/agents/chat` + Fast Chat / AI Council mode toggle (default Fast Chat).
- **W13B Step 1** — observability links: Audit entity links, Tasks→Decision link, Decisions agent-run copy.
- **W13B Step 2A** — query-param drawers: `/decisions?open=`, `/tasks?open=`, `/conversations?open=` auto-open the detail.
- **CORS/login local-origin fix** — dev origins (localhost/127.0.0.1 on :5173/:3000) allowed; clearer network error copy.
- **W14A visual foundation (safe):**
  - `frontend/src/index.css` palette → **Stealth Slate & Phosphor** tokens.
  - radius/shadow cleanup (matte, low-radius).
  - AppShell wordmark → **THUNITY**; Login wordmark → **THUNITY** + **Local Secure Login**.
  - added reusable `.brand-wordmark` and `.brand-subtitle` classes.
- **W14B Fast Chat UX (completed):**
  - latest-turn visual exchange: **You → Thunity Assistant**.
  - Conversations link now uses `/conversations?open=<conversation_id>`.
  - removed "models pulled" wording → "required council models visible in Observatory → Local Models."
- **W14C route separation (completed):** `/chat` = **Main Chat** (Fast Chat), `/council` = **AI Council** — separate routes + sidebar nav ("Main Chat" + "AI Council"); both still share `Council.tsx` via an `initialMode` prop (see "Route Separation" below).
- **Dashboard CTA (completed):** Dashboard header has a primary **"Open Main Chat"** → `/chat` and a secondary **"AI Council →"** → `/council`.
- **W14D Founder Insight panel (completed):** Fast Chat (`/chat`) only — right-side **Founder Insight / Local Policy** panel from frontend-local state + static policy text, no live health (see "Fast Chat Founder Insight Panel" below).
- **W14E maintainability (completed):** de-duplicated the saved-conversation link via a single `fastConvHref` derived in `Council.tsx` (identical UI/behavior; build-clean).
- **Last cumulative ZIP (historical):** `w14a-w14b-ui-foundation-cumulative-delta.zip` predates W14C/W14D/W14E, so it is **out of date** and is **not** the current priority.
- All changes built clean (`tsc --noEmit` + `vite build`).

## 2. Device / Sync Warning
- **All latest changes live on Acung's MacBook repo only.**
- **Joshua's Linux PC will NOT show them until the cumulative ZIP is sent and Joshua applies it.**
- **The demo runs on Joshua's Linux PC, not Acung's MacBook** — so visual QA on the MacBook proves the code, but Joshua must apply the ZIP (and restart frontend/backend) to see it.

## 3. Tomorrow Visual QA Checklist (pages to open)
- Login page
- AppShell — sidebar + topbar
- AI Council page — **Fast Chat** mode
- AI Council page — **Council** mode (checklist wording)
- Conversations deep link from a Fast Chat result
- Basic navigation across all pages (Dashboard, Knowledge, Decisions, Tasks, Approvals, Workflows, Tools, Audit, Observatory, Settings)

## 4. What To Verify Tomorrow
- [ ] THUNITY wordmark visible (sidebar + login).
- [ ] New dark palette (Stealth Slate & Phosphor) looks better / matte.
- [ ] Login still works (founder account).
- [ ] Auth behavior unchanged (401 → login; no auto-login).
- [ ] Fast Chat still works (one local model, quick reply).
- [ ] Fast Chat shows **You** + **Thunity Assistant** latest turn.
- [ ] Conversations link from Fast Chat opens the conversation **drawer** (`?open=`).
- [ ] AI Council still works (6 stages, synthesis, evaluation, transcript).
- [ ] Save Draft Decision / Create Task still only appear for **completed Council** results (not Fast Chat).
- [ ] No wording anywhere tells the user to pull/reinstall/download models.

## 5. Known Limitations
- No real logo asset exists in the repo yet; the mark is still the placeholder **◆**.
- Fast Chat shows a **local in-memory multi-turn thread** (cleared on reload / "Clear local thread"); full saved history is via the **Conversations** deep link, not re-fetched into the thread.
- Workflows / Approvals deep links (`?open=` / `?focus=`) are **not finished**.
- Joshua must apply the ZIP (and restart) before any of this is visible on the demo PC.
- A few non-brand component classes still use slightly larger radius (future broader CSS pass).
- Repo has accumulated stale `vite.config.ts.timestamp-*.mjs` / `.DS_Store` (cleanup via `scripts/safe_repo_cleanup.sh` on the MacBook).

## 6. Recommended Next Micro-Tasks (in order)
A. **Visual QA (still pending)** on the MacBook browser (`npm run dev`): open `/dashboard`, `/chat`, `/council`, and Login.
B. **Logo asset wiring** — only after a real SVG/PNG is provided in `frontend/public/` (mark is still the placeholder ◆).
C. Otherwise continue **tiny, safe one-file tasks** (docs cleanup, grep/build verification, single-file maintainability patches).
D. ZIP/sync to Joshua is **not** a current priority (Joshua unavailable; MacBook-only for now).

## 7. Stop Rules — do NOT start
- full UI redesign
- backend work
- Docker / Ollama / model work
- tool execution
- workflow execution
- high-risk actions
- document delete / restore
- broad frontend refactor

## 8. Tomorrow Commands
Visual check on the MacBook (clear stale dist first if `npm run build` is used):
```bash
cd "/Users/aaa/Documents/Claude/Projects/PROJECT AI COMPANY/thunity-ai/frontend"
npm run dev
```

Recreate the cumulative ZIP only if/when needed (not the current priority — and add the W14C–W14E files `frontend/src/App.tsx` and `frontend/src/pages/Dashboard.tsx` to the list below):
```bash
cd "/Users/aaa/Documents/Claude/Projects/PROJECT AI COMPANY/thunity-ai"
zip -r w14a-w14b-ui-foundation-cumulative-delta.zip \
  frontend/src/index.css \
  frontend/src/components/AppShell.tsx \
  frontend/src/pages/Login.tsx \
  frontend/src/pages/Council.tsx \
  -x "*/.git/*" \
  -x "*/node_modules/*" \
  -x "*/dist/*" \
  -x "*/__pycache__/*" \
  -x "*/.env"
```

## Route Separation — Main Chat and AI Council
- `/chat` is now the dedicated **Fast Chat** entry point (sidebar: "Main Chat"). Opens in Fast Chat mode.
- `/council` opens **AI Council** as the strategic mode.
- Both modes still share the same underlying `Council.tsx` page safely, selected via an `initialMode` prop (each route uses a distinct React key so it mounts in the right mode; the in-page Fast Chat ⇄ AI Council toggle still works).
- **Fast Chat remains side-effect free** (only `api.fastChat`; no decisions/tasks/approvals/workflows/tools).
- **AI Council remains the governed strategic flow** (Save Draft Decision / Create Task Council-only; Use Knowledge Base Council-only; Recent Council Activity shows in Council mode only).
- No backend/API behavior changed.

## Fast Chat Founder Insight Panel
- `/chat` (Fast Chat) now has a lightweight **Founder Insight / Local Policy** panel to the right of the chat thread (`.fast-workspace` → `.fast-main` + `.fast-side`).
- The panel uses **only frontend-local state and static policy text** — it does **not** fetch backend/Ollama/database health and does **not** pretend to be live system monitoring.
- Sections: **Local Policy** (Local-only · No tools · No workflow execution), **Session** (Local turns = local thread length; Conversation saved = Yes/No from `fastConvId`), **Next Step** (guidance copy + a quiet "Open saved conversation →" link to `/conversations?open=<id>` when a conversation exists).
- **Fast Chat remains side-effect free** (still only `api.fastChat`; no decisions/tasks/approvals/workflows/tools).
- **AI Council remains the governed strategic mode**; its layout/flow is unchanged (the workspace wrapper applies in Fast mode only).
- **Save Draft Decision / Create Task remain Council-only.**
- **Use Knowledge Base remains Council-only.**
- Full conversation history remains available via the Conversations deep link (panel link + the Fast Assistant card "Open conversation →").
- Panel stacks below the chat area on narrow screens (≤ 900px).

## Current Next Best Move
- **If browser access is available:** do the pending **visual QA** — open and eyeball `/dashboard`, `/chat` (Fast Chat + Founder Insight panel), `/council` (AI Council), and the **Login** page. Confirm nothing regressed; log any issue as a new tiny patch.
- **If browser access is not available:** stay on **tiny, safe, build-/review-verifiable tasks only** — docs cleanup, `grep`/`npm run build` verification, or single-file maintainability patches. No visual redesign, no backend, no ZIP/sync.
- Reminder: **Fast Chat stays side-effect free**; **Save Draft Decision / Create Task / Use Knowledge Base remain Council-only**; real logo asset still not in repo; visual QA after W14D still pending.

## W14G — Fast Chat Trust & Local-Secure Polish
- **Local-secure token added:** `--local: #00D4B2;` in `index.css` `:root` (reserved for local/private/secure cues only — not a general primary color).
- **Fast Chat trust clarity:** the Founder Insight **Local Policy** section now reads as a trust contract — a compact "Local Secure — answers only, no side-effects." line plus `--local` check marks on **Local-only · No tools · No workflow execution**; a small static **Local-Secure** cue sits next to the Fast Chat header title.
- **Honest/static only:** no live model/backend/database/workflow/queue health is implied; nothing claims an action executed.
- **No behavior change:** no backend/API/route/auth/governance change. Fast Chat is still side-effect free (only `api.fastChat`). **Save Draft Decision / Create Task / Use Knowledge Base remain Council-only.**
- **Visual QA still pending; the product is not visually final yet.**

## W14H — Repo Hygiene: ignore temporary Vite build dirs
- Added a focused **`.gitignore`** (none existed before) that ignores regenerable artifacts — notably `frontend/dist/`, `frontend/dist_tmp/`, and `frontend/dist_*/` (the throwaway verify-build dirs left by W14C–W14G), plus `node_modules`, Python/test caches, `.DS_Store`, the Vite timestamp file, root-level `*.zip`, and real `.env` (keeps `.env.example` tracked).
- `scripts/safe_repo_cleanup.sh` and `scripts/create_clean_zip.sh` **already** remove/exclude `frontend/dist` and `frontend/dist_*` (the `dist_*` glob already matches `dist_tmp`), so no script change was needed; the cleanup script stays **dry-run by default**.
- **Repo hygiene only** — no runtime/UI/CSS/API/route/auth/governance/backend/Docker/Ollama/model change.
- Stray dirs already on disk must be cleared manually on Acung's MacBook (the sandbox mount blocks deletion): `rm -rf frontend/dist_*` (covers `dist_tmp` and the `dist_<timestamp>` dirs).

## W14I — Fast Chat Empty-State Clarity
- `/chat` Fast Chat now shows a small honest empty-state cue **only before the first message** (`mode === "fast"` and `fastTurns.length === 0`), inside the workspace main column under the suggestions.
- Copy: "Ask anything — responses stay local and side-effect-free." + "Fast Chat can answer, summarize, and reason. It will not create tasks, decisions, workflows, or tool calls."
- Styling: one new `.fast-empty-state` class — subtle border with a quiet `--local` left accent, matte `--bg-2`, muted sub-line; no extra card/badge noise. It disappears once the first local turn appears.
- **No backend/API/route/auth/governance change**; Fast Chat stays side-effect free (only `api.fastChat`); Save Draft Decision / Create Task / Use Knowledge Base remain Council-only.
- **Visual QA still pending; product is not visually final yet.**

## W14J — Fast Chat Input Accessibility
- The Fast Chat / Council textarea is now programmatically associated with its existing help text via `aria-describedby={fastInputHelpId}` (`id="fast-chat-input-help"` on the "…⌘/Ctrl+Enter to send/run" hint), so assistive tech announces the shortcut when the input is focused.
- No new copy or element — the existing hint span just gained an `id`; no CSS change.
- **No runtime/governance behavior changed** (submit / Enter / button / suggestions / escalate all unchanged); Fast Chat stays side-effect free.
- **Visual QA still pending.**

## W14K — Fast Chat Input A11y, Error Clarity & Safe Retry
- **Accessible name:** the shared textarea now has a mode-aware `aria-label` ("Fast Chat message" / "AI Council question"); the W14J `aria-describedby={fastInputHelpId}` help-text wiring is preserved.
- **Error clarity:** Fast Chat error turns show the honest failure ("⚠ <actual error>", fallback "The local response didn't complete.") — no model/backend/database health claims, no execution implied.
- **Safe retry:** error turns get a quiet **Retry prompt** button that only re-fills the textarea with the original user prompt (`fillPrompt(t.prompt)`) — it does **not** auto-submit, does **not** call `api.fastChat`, and creates no decisions/tasks/workflows/approvals/tools. A muted note reads "Re-fills your message — nothing was sent or executed." Retry never appears on successful turns.
- **Side-effect free preserved:** Fast mode still submits only via `api.fastChat`; suggestion chips and Escalate-to-Council remain fill-only; Clear local thread stays local; saved-conversation links stay gated on `fastConvHref`.
- **CSS:** one small `.fast-retry` selector (matte, low-radius, quiet) — no new card/badge system.
- **No backend/API/route/auth/governance change.** Save Draft Decision / Create Task / Use Knowledge Base remain Council-only.
- **Visual QA still pending; product is not visually final yet.**

## W14L — Fast Chat Live-Region Accessibility
- The Fast Chat thread container (`.fast-thread`, which renders `fastTurns`) is now a **polite live region**: `aria-live="polite"`, `aria-relevant="additions text"`, `aria-atomic="false"`, so new turns and updated assistant text are announced without interrupting the user.
- `aria-busy={fastTurns.some((t) => t.status === "pending")}` marks the region busy while a local response is pending.
- Scope limited to Fast Chat — **no** live-region attributes added to AI Council transcript/result areas.
- W14J/W14K wiring preserved (`aria-describedby={fastInputHelpId}`, mode-aware textarea `aria-label`, fill-only retry).
- **No runtime/API/governance behavior changed.** Real browser/screen-reader QA still pending.

## W14M — Fast Chat Pending Status Role
- The Fast Chat pending indicator ("Thinking locally…") now carries `role="status"` so assistive tech recognizes it as a status message.
- `aria-live` was **intentionally not** added to the indicator to avoid duplicate/noisy announcements — the `.fast-thread` parent is already a polite live region (W14L), and `role="status"` carries implicit polite semantics.
- W14L `.fast-thread` live-region attributes and W14J/W14K textarea wiring (`aria-describedby={fastInputHelpId}`, mode-aware `aria-label`) preserved.
- **No visible UI/runtime/API/governance change.** Browser/screen-reader QA still pending.

## W14N Manual QA Checklist
Run on Acung's MacBook (`cd frontend && npm run dev`). Covers W14G–W14M (unverified). Not QA-complete until a human runs this; product is not visually final.

### A. Per-page browser checks
- [ ] **Login** — THUNITY wordmark + Local Secure cue; sign-in works; 401 returns to login (no auto-login).
- [ ] **/dashboard** — header shows primary **Open Main Chat** → `/chat` and secondary **AI Council →** → `/council`; briefing/metrics still render.
- [ ] **/chat** — opens in **Fast Chat** mode; header title + **Local-Secure** cue; suggestions; Founder Insight panel on the right (stacks below on narrow widths ≤900px).
- [ ] **/council** — opens in **AI Council** mode; 6-stage flow, synthesis, evaluation, transcript all intact; no Fast Chat panel.
- [ ] Sidebar nav switches **Main Chat** / **AI Council** correctly; in-page Fast Chat ⇄ AI Council toggle still works.

### B. Fast Chat product checks
- [ ] Empty-state cue appears **only before the first local turn**; disappears after the first message.
- [ ] **Local-Secure** cue is visible but quiet (not neon/noisy); `--local` teal reads well on matte.
- [ ] Founder Insight → **Local Policy** reads as a trust contract ("Local Secure — answers only, no side-effects." + Local-only / No tools / No workflow execution with check marks).
- [ ] Session rows correct: **Local turns** = thread length; **Conversation saved** = Yes only after a conversation id exists.
- [ ] **Retry prompt** appears **only** on error turns (never on pending or successful turns).
- [ ] **Retry** only re-fills the textarea with the original prompt and focuses it — it does **not** auto-submit and sends nothing.
- [ ] "Open saved conversation →" / "Open conversation →" appear only when a conversation exists (`fastConvHref`).

### C. Governance checks (must stay true)
- [ ] Fast Chat sends only through the normal Fast Chat submit path (one local model); no tools/workflows/tasks/decisions/approvals are ever created from `/chat`.
- [ ] **Save Draft Decision / Create Task / Use Knowledge Base** appear **only** in AI Council (completed result), never in Fast Chat.
- [ ] No copy implies live backend/model/database/workflow/queue health, and nothing claims an action executed unless it actually did.
- [ ] Escalate-to-Council fills the prompt and switches mode but does **not** auto-submit.
- [ ] Clear local thread clears only the local view (saved conversation history is untouched).

### D. Accessibility checks (real screen-reader pass: VoiceOver/NVDA)
- [ ] Textarea has a mode-aware accessible name ("Fast Chat message" / "AI Council question").
- [ ] Shortcut/help text ("⌘/Ctrl+Enter to send/run") is announced via `aria-describedby` on focus.
- [ ] Fast thread announces **new** turns politely (additions/text), without interrupting typing.
- [ ] Pending **"Thinking locally…"** announces **once** (not repeated/spammed) — `role="status"` + parent polite region should not double-announce.
- [ ] Error state is understandable when read aloud; do **not** escalate to assertive `role="alert"` unless this QA proves polite is insufficient.

### E. Visual rubric (rate each: ok / needs work)
- [ ] **Brand alignment** — Stealth Slate & Phosphor; no neon/chrome/glass/cyberpunk.
- [ ] **Premium matte feel** — low radius, hairline borders, minimal shadow.
- [ ] **Functional clarity** — actions and states are obvious.
- [ ] **Mode clarity** — Fast Chat vs AI Council are clearly distinct.
- [ ] **Safety clarity** — local-only / side-effect-free contract is legible.
- [ ] **Hierarchy / noise / trust** — calm, not over-boxed; trust cues feel earned, not decorative.

Log any failures as new tiny single-file patches (e.g., W14-fixes), not a broad redesign.

## W14O — AI Council Trust & Result-State Honesty
- **Council header trust cue (Council mode only):** the New Session header now mirrors Fast Chat's layout with an "AI Council" title/subtitle plus three static chips — **Strategic review · Drafts only · Founder approval required**. Not shown in Fast Chat.
- **Result-state honesty:** completed Council results carry a compact serious line above the action buttons — the output is a local **recommendation / draft**, **not an executed action**, and a draft decision or task is created **only when you confirm**, never automatically; execution and approvals remain gated.
- **No auto-execution added.** Save Draft Decision / Create Task keep their explicit confirm flow and Council-only gating; no new buttons; payload shape unchanged.
- **Fast Chat unchanged and side-effect free** (still only `api.fastChat`); `/chat` = Fast Chat, `/council` = AI Council.
- **CSS:** reused existing styles; only added `.council-mode-head` as a grouped alias of `.fast-mode-head` (no new visual system).
- **Visual QA still pending; product is not visually final yet.**

## W14P — AI Council Action-Button Context (a11y) & Confirmation Clarity
- The W14O recommendation/draft note now has `id="council-action-context"`, and the completed-result action buttons (Save as Draft Decision + Confirm Save, Create Task + Confirm Create) reference it via `aria-describedby={councilActionContextId}` — screen-reader users hear "recommendation/draft, not executed, created only on confirm" when focusing those buttons.
- Confirmation prompts clarified (compact): Save = "…DRAFT decision? Creates a record only — no execution."; Create = "…BACKLOG task? Creates a task record only — not a workflow run." No new confirm steps, no new buttons.
- **Council behavior unchanged:** Save/Create still only via the existing explicit click→confirm flow; Council-only gating, Use Knowledge Base Council-only, API payload shape, and the 6-stage flow all unchanged.
- **Fast Chat unchanged and side-effect free** (only `api.fastChat`; retry fill-only); `aria-describedby` was not added to any Fast Chat button.
- No CSS change. **Visual and screen-reader QA still pending; product is not visually final.**

## W14Q Current Checkpoint
State of `/chat` and `/council` after W14G–W14P (all built clean; none browser/screen-reader verified yet).

- **W14G** — Fast Chat local-secure/trust cue: `--local: #00D4B2` token; static "Local-Secure" header cue; Local Policy reads as a trust contract.
- **W14H** — repo hygiene: `.gitignore` ignores `frontend/dist_*`/`dist_tmp` (cleanup/zip scripts already excluded them).
- **W14I** — Fast Chat empty state appears only before the first local turn; honest "answers stay local and side-effect-free" copy.
- **W14J** — Fast Chat textarea help text associated via `aria-describedby` (id `fast-chat-input-help`).
- **W14K** — mode-aware textarea `aria-label`; clearer error copy; **fill-only Retry** (refills prompt, never auto-submits, no API call).
- **W14L** — `.fast-thread` is a polite live region (`aria-live="polite"`, additions/text, `aria-busy` on pending).
- **W14M** — pending "Thinking locally…" carries `role="status"` (no duplicate assertive announcement).
- **W14O** — AI Council trust chips (**Strategic review · Drafts only · Founder approval required**) + recommendation/draft honesty line above actions.
- **W14P** — Council action buttons reference the draft/recommendation note via `aria-describedby` (id `council-action-context`); confirm prompts clarified ("record only — no execution" / "task record only — not a workflow run").

### Next required gate (do this before more UI polish)
- **Do not stack more Fast Chat / AI Council UI polish until manual QA runs.** W14G–W14P have accumulated unverified UI/accessibility changes.
- Next gate = run the **W14N Manual QA Checklist** in a browser on the MacBook, and if possible a screen-reader pass (VoiceOver/NVDA).
- Turn any failures into **tiny single-file patches** (e.g., W14-fixes) — not a broad redesign.

### Truths still in force
- Fast Chat remains **side-effect free** (only the Fast Chat submit path / `api.fastChat`).
- AI Council remains **governed** (Save Draft Decision / Create Task / Use Knowledge Base Council-only; explicit confirm; no auto-execution).
- **Visual QA still pending. Screen-reader QA still pending.** Real logo asset still not in repo.
- Product is **demo-capable but not visually final.**

## W15A — Dashboard “Founder Command Center” polish (frontend-only)
- Files: `frontend/src/pages/Dashboard.tsx` + `frontend/src/index.css` only (plus this note). No other files touched.
- Reframed the launch surface from a generic **Dashboard** header into a **Founder Command Center / Local AI Company OS** identity: eyebrow `THUNITY · Local AI Company OS`, a static **Local-Secure** chip reusing the existing `--local #00D4B2` token (positioning cue only — **not** a live-health/online claim), and a product-specific lede.
- **Stale copy fixed:** removed “approval flow (next sprint)” — approvals already exist; copy is now present-tense (“sensitive actions stay gated behind founder approval”).
- The two core entry points (**Open Main Chat → `/chat`**, **AI Council → `/council`**) are now an intentional paired `.dash-entries` block with honest sub-labels (Fast Chat = “answers only, no side-effects”; Council = “drafts & recommendations, founder-approved”). **CTA targets unchanged.**
- **Founder Daily Briefing** given visual primacy via a `.dash-briefing` wrapper (accent left border + elevated `--panel-2` surface); the operations grid is framed below as “Operations & Governance · read-only detail”. No cards or metrics removed/restructured.
- New CSS is Dashboard-scoped (`.dash-hero/.dash-eyebrow/.dash-secure/.dash-lede/.dash-entries/.dash-entry/.dash-briefing/.dash-section-label`); no shared component styles changed; matte / low-radius / no gradient per brand guide.
- **No runtime/API/route/governance behavior changed:** all four `useAsync` hooks, every `/api/...` card hint, Fast Chat / AI Council, and routes are untouched. No fake live status added.
- **Visual QA still pending** (browser + screen-reader); product is **not** visually final. W14N manual QA (Fast Chat / AI Council) remains separately open.

## W15B — Main Chat (/chat) chat-first cockpit alignment (frontend-only)
- Files: `frontend/src/pages/Council.tsx` (Fast mode only) + `frontend/src/index.css` (`.fast-*` scoped) + this note. No other files touched.
- Aligned `/chat` Fast mode toward the provided chat-first command-center reference, adapted not copied. **Note:** the uploaded JPEG references could not be opened by the file tool in this session, so `THUNITY_BRAND_UI_GUIDE` §3/§10 (its written description of the same reference) was used as the authoritative source.
- **Central chat canvas:** `.fast-main` is now a relative cockpit canvas (min-height) with a faint centered **THUNITY ◆ monogram watermark** (`aria-hidden`, ~0.04 opacity, existing placeholder glyph + wordmark text — no new logo asset). Content sits above the watermark.
- **Empty hero:** the W14I empty state is restyled as a centered hero (title + honest sub + a `--local` “Local-secure · one local model · no side-effects” cue); still renders only before the first local turn; copy stays side-effect-free.
- **Quick start:** suggestion chips kept near the input under a quiet “Quick start” label, slightly larger but matte; fill-only behavior unchanged (Escalate still switches mode only, no auto-submit).
- **Message hierarchy:** assistant turns are now a subtle card (panel surface + accent left border); dashed divider between turns; metadata line preserved.
- **Composer:** Fast-mode textarea gets a `.fast-input` class (stronger matte border, more padding, command-input feel) **only in Fast mode**; Council-mode textarea unchanged.
- **Founder Insight panel:** sections restyled as compact stacked cards with quiet borders; added an honest sub-label “Local policy & session context — not live system health” (no live health, no fake status).
- **W14 wiring preserved:** Local-Secure cue, empty state, mode-aware `aria-describedby`/`aria-label`, retry fill-only, `.fast-thread` polite live region (`aria-live`/`aria-relevant`/`aria-atomic`/`aria-busy`), pending `role="status"` — all intact.
- **No runtime/API/route/governance change:** Fast Chat still calls only `api.fastChat`; no tools/workflow/decision/task/approval creation; AI Council layout/governance untouched.
- **Visual QA still pending** (browser + screen-reader); product **not** visually final. W14N manual QA remains the open gate.

## W15C — AppShell product frame polish (sidebar / brand / topbar, frontend-only)
- Files: `frontend/src/components/AppShell.tsx` + `frontend/src/index.css` + this note. No other files touched.
- **Brand:** the sidebar THUNITY block is now a matte tile-framed ◆ mark + stronger wordmark (wider tracking) + clearer uppercase “Local AI Company OS” tag, with a divider beneath. All brand CSS is scoped under `.sidebar`, so Login's brand lockup is unchanged. No new logo asset (existing ◆ placeholder reused).
- **Navigation:** the flat 13-item list is now grouped into labeled sections — **Workspace / Knowledge & Governance / Automation / System** — purely visual. **All 13 routes/targets preserved; none added or removed.** Main Chat and AI Council sit in the top Workspace group and are marked `primary` (brighter text). Cleaner active state (panel-2 + inset accent bar + bold), tighter in-group spacing with clear group separation.
- **Footer:** quieter/more premium (top divider, smaller faint text); same “Founder-controlled · Auditable · Private” copy.
- **Topbar:** the raw “Ollama/DB/n8n” line is visually de-emphasized (faint mono, divider-separated) but **not hidden and not faked** — still the real `api.localOnly()` values; the LOCAL-ONLY badge stays prominent and the non-compliant warning banner is unchanged. User identity shows name + a small role chip.
- **No route/auth/API/governance change:** NavLink targets identical; `logout()` + `nav("/login")` unchanged; `api.localOnly()` fetch unchanged; no fake health, no hidden warnings.
- **Visual QA still pending** (browser + screen-reader); product **not** visually final.
