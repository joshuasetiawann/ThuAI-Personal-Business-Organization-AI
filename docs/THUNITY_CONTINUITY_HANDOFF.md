# THUNITY — CONTINUITY HANDOFF (read this first)

**Author:** Claude (Claude Code, Opus 4.8) · **Date:** 2026-06-06 · **Purpose:** a complete, self-contained brain-dump so a *fresh session with zero memory of the prior conversation* can continue exactly where the last one stopped. Written at the founder's explicit request, before the context window fills.

> If you are a new session: read this top-to-bottom once, run the **Boot checklist** (§2), then execute the **Active task** (§10). Everything you need is here.

---

## 1. WHO & WHAT

- **Product:** **Thunity AI** — a *private, local-first AI Company OS* (not a chatbot). Surfaces: Main Chat (fast local assistant), AI Council (6-stage governed deliberation), Knowledge Vault (local RAG), Decisions / Tasks / Approvals (governed ledgers), Workflows, Tools, Audit, Observatory, Settings, Dashboard.
- **Founder / user:** "Acung" (account `thunityproject@gmail.com`). Communicates in **Indonesian**. He is a **non-coder, intensely design-driven founder**. He iterates by sending screenshots and reacting. He is testing Claude Max/Claude Code capability and wants Thunity to *visually rival famous frontier AI products (Gemini, Claude, Manus, Stitch, Grok)* — "not just impressive in capability, but in look & feel." He dislikes anything **"norak"** (gaudy/garish) or too bright; he loves **elegant, simple, calm, premium, futuristic**. He deeply values **honesty (no-fake-success)**.
- **Biggest goal:** a believable frontier-grade private AI Company OS that stays local-first, governed, auditable — and *feels* world-class.

## 2. BOOT CHECKLIST (run before doing anything)

1. `pwd` → confirm official repo: **`/Users/aaa/Documents/Claude/Projects/PROJECT AI COMPANY/thunity-ai`** (this is the ONLY active repo; do NOT use `PROJECT AI BUILDING`, the `thunity-clean/` subfolder, or `THUWEALTH AI`). **There is no `.git` here** — no version control / rollback, so be careful with destructive commands.
2. Health: `bash scripts/check_thunity_health.sh` (read-only). Expect Backend :8000, Frontend :3000, Ollama :11434, postgres/redis/n8n all up.
3. **Live stack (already running on Acung's Mac):**
   - Frontend dev (Acung's): **http://localhost:3000** (Vite, official build).
   - Backend: Docker container **`thunity-backend`** on `127.0.0.1:8000`. Code is **bind-mounted** (`./backend:/app`) BUT uvicorn runs **WITHOUT `--reload`** (Dockerfile CMD). **⇒ after ANY backend edit you MUST `docker restart thunity-backend`** (safe, non-destructive) and wait for HTTP 200. Never `docker compose down -v`, never delete volumes/models.
   - Ollama: host on **:11434**, models installed: `qwen2.5:3b-instruct`, `qwen2.5:7b-instruct`, `nomic-embed-text`. (Council models `llama3.1:8b` + `qwen2.5-coder:7b` are NOT pulled.)
   - Postgres/redis/n8n: Docker containers up.
4. **Login creds (local dev, already in `.env`):** `founder@thunity.local` / `thunity_founder_local_password`. (`.env` also has `POSTGRES_PASSWORD=thunity_local_password`, `N8N_BASIC_AUTH_PASSWORD=...`, a sentinel `SECRET_KEY`.) **Do not commit/leak real secrets; these are throwaway dev values Acung approved.**

## 3. HOW I WORK (operating method — reuse this)

- **Browser preview = the Claude_Preview MCP** (`mcp__Claude_Preview__*`). It reads `/Users/aaa/Documents/Claude/Projects/PROJECT AI COMPANY/.claude/launch.json`. The config there is named **`thunity-fe`** running `npm --prefix thunity-ai/frontend run dev -- --port 5173` (port 5173 because backend CORS `ALLOWED_ORIGINS` includes :5173). Use `preview_start("thunity-fe")` → get a `serverId`. Then `preview_screenshot(serverId)`, `preview_eval(serverId, expr)`, `preview_resize`, `preview_console_logs`, `preview_snapshot`.
- **Login in preview:** the session view often drops to /login after a full reload. Re-login via `preview_eval`: set the two `input` values with the native setter + dispatch `input` event, then click `.btn-primary`. (Screenshots compress small; **the `preview_eval` text/DOM extraction is the reliable signal** for verifying content/state.)
- **Viewport resets to ~native on full reload** → re-`preview_resize` to 1440×940 after each reload before screenshotting.
- **Send a chat message in preview:** set the `.composer-bar textarea` value (native setter + input event) then dispatch `keydown` Enter with `metaKey/ctrlKey` (⌘/Ctrl+Enter submits).
- **Frontend build/verify:** `cd frontend && rm -rf dist && npm run build` (= `tsc --noEmit && vite build`). MUST `rm -rf dist` first (sandbox can hit EPERM overwriting dist). Green build is required but NOT sufficient — always eyeball in the browser.
- **Memory test (backend):** login via curl → POST `/api/agents/chat` twice in the same `conversation_id` and check the 2nd reply recalls the 1st.
- **My loop:** read exact files → make scoped edits → build → reload preview → screenshot + `preview_eval` inspect + `preview_console_logs(error)` → self-critique vs the target → patch → repeat. I verify responsive at 1440 / 768 / 390 (`overflowX` must be false).

## 4. ARCHITECTURE & KEY FILES

**Frontend** (`frontend/`, React 18 + Vite + TS, single big stylesheet):
- `index.html` (title, favicon `/favicon.png`), `src/main.tsx`, `src/App.tsx` (routes; landing route `/` = Dashboard; `/chat` and `/council` both render `<Council>` with `key` + `initialMode`).
- `src/components/AppShell.tsx` — the shell: sidebar (brand mark, flat icon nav `NAV_ITEMS`+`NAV_ICONS`, Recent Conversations with `timeAgo`, **user card at bottom**, version footer), topbar (page title, `STATUS:` secure pill from real `lo.status`, **Model pill = button with caret + honest popover** (`modelInfo` state), Sign out). `BrandMark` renders `/thunity-mark.png` (◆ fallback).
- `src/pages/Council.tsx` — **the most important page.** ONE component does BOTH **Main Chat** (`initialMode="fast"`) and **AI Council** (`initialMode="council"`).
  - Fast mode = `.chat-cockpit` grid: center thread/empty-hero/composer + right **`FounderInsightPanel`** (real read-only data: System Status, Founder Context, Recent Decisions, Pending Approvals, Local Vault, session card, tagline). Empty hero = big logo (`.fast-empty-logo`) + "Ask Thunity anything" + chips + composer (the composer is `.chat-composer` with `.composer-bar` + switch-style `.mode-switches` toggle + Escalate; suggestion chips `.composer-quickstart`). Watermark monogram behind thread (`.chat-watermark .mark-glyph`).
  - Council mode = `.council-cockpit` grid: center hero (purple `.council-logo` + "Convene the AI Council" + composer) + right **`.council-aside` "Deliberation Pipeline"** stepper (`COUNCIL_PIPELINE` const). Results (synthesis/evaluation/transcript) render below.
  - `runFast()` → `api.fastChat`. `runCouncil()` → `api.council`. `saveDraft`/`createTask`/Use-KB are **council-mode-only** (governance).
  - **Resume:** `pairMessagesToTurns()` + a `useEffect` on `?conv=` (via `useSearchParams`) loads a saved conversation into `fastTurns` and sets `fastConvId` so it continues. Sidebar Recent links to `/chat?conv=<id>`.
- `src/pages/Login.tsx` — premium centered card (LoginMark, "Founder Command Center", `.login-aura` watermark, phosphor "Local-secure" cue).
- `src/pages/Dashboard.tsx` (Founder Command Center exec view), and data pages: `Conversations, Knowledge, Decisions, Tasks, Approvals, Workflows, Tools, Audit, Observatory, Settings`.
- `src/components/ui.tsx` (`Card, Badge, PageHeader, useAsync, …`), `src/api/client.ts` (base = `VITE_API_URL || http://localhost:8000`; JWT in `localStorage['thunity_token']`; `api.fastChat`, `api.council`, `api.conversationMessages(id)`, etc.), `src/auth/AuthContext.tsx`, `src/types.ts`.
- **`src/index.css`** — the single source of styling, organized in numbered sections: **0** self-hosted `@font-face` (Inter + JetBrains Mono from `public/fonts/*.woff2`), **1** `:root` tokens (palette), 2 buttons, 3 login, 4 shell/sidebar/topbar, 5 badges/cards, 6 data primitives, 7 states/banners/drawers, 8 AI Council workspace, 9 dashboard, 10 chat cockpit/composer/Founder Insight, 11 responsive (media queries), 12 "W20C" (switch toggle, model popover, motion/micro-interactions), 13 "W20D" (sidebar user card, rich Founder Insight, big logo, council cockpit).
- `frontend/public/`: `thunity-mark.png` (white monogram, transparent, ~30% padding — extracted from `references/brand/...0c109365.jpeg` via Pillow), `favicon.png`, `fonts/inter-{400,500,600,700}.woff2`, `fonts/jbmono-{400,500}.woff2`, `brand/README.md`.

**Backend** (`backend/`, FastAPI + async SQLAlchemy + Postgres + local Ollama; "Shot 2"):
- `api/routes/agents.py` — `POST /api/agents/chat` = **fast_chat** (now WITH conversation memory: loads `cs.get_recent_messages(db, conv_id, limit=12)` before adding the new message, builds `chat_messages = [system, …history…, current]`). `POST /api/agents/council` = run_council (6 stages). Side-effect-free contract intact.
- `services/conversation_service.py` — has `create_conversation, get_conversation, can_access, add_message, **get_recent_messages**`.
- `agents/{council,model_router,ollama_client,prompts}.py`, `core/{security,permissions,local_only,audit,errors}.py`, `services/*`, `tools/{registry,executor,schemas}.py`, `db/models.py`, `config.py`, `main.py`.

## 5. DESIGN SYSTEM (current `:root` tokens — keep unless redesigning)

```
--bg:#0B0E13  --bg-2:#10141b  --panel:#12161C  --panel-2:#1a1f28
--line:#232a35  --line-2:#2c3542
--txt:#EDF0F4  --muted:#99a2af  --faint:#5b6573
--accent:#4F8BFF (Primary blue)  --accent-2:#7fa9ff  --local:#1FC7B6 (Secondary teal)  --tertiary:#8B5CF6 (purple)
--ok:#34D399  --warn:#FBBF24  --bad:#F87171  --radius:10px
--font:"Inter",…   --mono:"JetBrains Mono",…
```
Source: Acung's own design-system sheet (`~/Documents/MOCKUP/image-1.png`): Primary `#4F8BFF`, Secondary `#1FC7B6`, Tertiary `#8B5CF6`, Neutral `#12161C`, Inter + JetBrains Mono.

**⚠️ CSS gotcha:** sections 12/13 are appended AFTER the §11 media queries. A *new* base rule for a *new* class placed after the media queries will **override** those media queries (equal specificity, later source wins). So when you add a class that must change at a breakpoint, add its media-query rule AT THE END (after the base rule). (This bit me twice — sidebar user-card hide + watermark.)

**Logo color-grading technique:** the white PNG is used as a CSS `mask` (`-webkit-mask/mask: url("/thunity-mark.png") center/contain no-repeat`) on an element whose `background` is a gradient → a gradient-filled monogram. For a *white* monogram with an *ambient glow*, instead use `::after` (white `background` + mask) + `::before` (radial-gradient glow around it). **Acung's latest verdict: the gradient-FILLED logo is "norak"; he wants the monogram subtle/white with the color/glow in the SURROUNDINGS (Gemini-style), and overall MUCH more minimal/elegant.**

## 6. GOVERNANCE & SAFETY — NEVER REGRESS

- **Fast Chat (`/api/agents/chat`) stays side-effect-free:** one local model, persists only conversation messages + a `fast_chat` audit row + (now) reads history. Never creates decisions/tasks/approvals/workflows/tool calls.
- **Council-only writes:** Save Draft Decision / Create Task / Use Knowledge Base appear ONLY in council mode.
- **No fake status:** live probes for backend/db/ollama/n8n; dots never forced green; failures show as failed/skipped/not_implemented; "Backup: never" shown honestly (do NOT fake "100%"). "All Systems Operational" only when all probes are really ok.
- **Local-only:** no external AI/cloud calls anywhere; `LOCAL_ONLY_MODE=true`. Self-host fonts (done) — never load from a runtime CDN.
- **AI proposes, founder decides**; high/critical needs approval; AI never self-approves; audit append-only.
- Edits in scope: frontend UI freely; backend only when the task needs it (memory was authorized) and restart the container after.

## 7. WHAT'S BEEN BUILT (history, newest first)

- **W20E (just done):** ① Logo → big monogram + (was gradient-filled). ② **Backend conversation MEMORY implemented & verified** (fast_chat feeds last 12 turns; tested: it recalled "teal/Pixel"). ③ **Recent conversations are resumable** (click → loads history into Main Chat → continue, with memory). ④ AI Council "cockpit" with purple accent + Deliberation Pipeline stepper.
- **W20D:** THUNITY design system (palette + self-hosted Inter/JetBrains Mono), sidebar **user card** + blue active nav + recent timestamps, rich **Founder Insight Panel** (sparkle head, uppercase-mono labels, "All Systems Operational", teal dots, check-circles, risk badges, tagline).
- **W20C:** switch-style Fast/Council toggle, Model pill → caret + honest popover, motion/micro-interactions (message entrance, focus-glow, hover-copy), Local Vault sparkle.
- **W20B / W19 / W18 / W17:** mockup-fidelity cockpit rebuild (kill dead-space, transcript-style turns), the **real logo extraction + wiring** (replaced ◆ placeholder), premium Login redesign, the W17 frontier chat cockpit, workspace consolidation. See `docs/W14_UI_UX_HANDOFF.md` (W14→W20E notes) and `docs/WORKSPACE_CONSOLIDATION.md`.

## 8. THE PRODUCT'S REAL STATE (deep non-UI audit, 2026-06-06)

Thunity can **analyze & record**, but largely **cannot DO** yet. Top gaps (full detail was delivered to Acung; key ones):
- **Tools are a no-op** (`tools/executor.py` `HANDLERS={}` → every tool returns `not_implemented`). Sandbox executes nothing. n8n has **no workflow definitions** (triggers 404→failed). Approval→Execute dead-ends. → "governance theater."
- **Memory:** WAS stateless — **now FIXED for Fast Chat** (Council still stateless).
- **No streaming** (`ollama_client.chat` is `stream:False`). **Acung wants streaming** (frontier feel).
- **Ops fragility:** **no git**; **backup script tars the empty host `./data`** instead of the Docker volume (real data unprotected — data-loss landmine); `create_all` each boot (Alembic decorative); only `print()` logging; errors vanish if DB down.
- **Security (single-founder threat model):** no login rate-limit; **IDOR** (any auth user can read any task/decision by id); no JWT revoke; `BACKEND_HOST=0.0.0.0` default; in-council create-decision/task bypasses `CREATE_DRAFT_DECISION`/`CREATE_TASKS`.
- **RAG:** in-process linear cosine over all chunks (no pgvector); no reranking. **No scheduler** (Redis unused). **Notifications** = table only. **No real connectors** (manual upload only).
- Strengths: 6-stage Council, local RAG, decisions/tasks/approvals/audit fully wired, hardened uploads, real local-only enforcement, honest status, production `startup_safety_check`.

## 9. DESIGN REFERENCES — MY ANALYSIS (Acung sent these as the target)

Reference screenshots live in **`~/Documents/MOCKUP/`** (`image.png`, `image-1.png` = his design system, `image-2.png` = his Main Chat target). The newest references (Gemini / Claude / Manus / Stitch desktop apps) were pasted into chat — they may NOT be on disk; **if you can't find them, ask Acung to re-send, but here is exactly what they look like:**

- **Gemini desktop (THE north star for the empty/just-opened state):** near-pure-black canvas, HUGE amount of negative space, a single centered **elegant light greeting** "Halo Thunity, Apa yang Anda pikirkan?" in a thin clean sans, the small 4-color Gemini sparkle at top-center, a rounded pill input at the bottom ("Minta Gemini" + "Flash" + mic), a **very subtle dark-blue gradient glow only at the very bottom edge**, and a **collapsible left sidebar** (toggle at top-left → "Chat baru", "Koleksi", "Notebook", chat history, account at bottom). **NO right dashboard. Calm, minimal, elegant.**
- **Claude desktop:** warm dark-gray, centered serif greeting "✳ What shall we think through?" (orange asterisk + serif), one rounded input "Type / for skills" with model selector (Sonnet 4.6 · Max) + mic, suggestion chips (Write/Learn/Code/Life stuff/Claude's choice), a **thin LEFT ICON RAIL** (collapsed sidebar with a toggle at top-left to expand) and user avatar bottom-left. Minimal chrome.
- **Stitch (Google):** big bold heading "Design at the speed of AI", a **glassmorphic input card** floating over a vibrant **purple/blue aurora gradient** rising from bottom-left, App/Web segmented toggle + model selector (3 Flash) + suggestion chips. Futuristic, premium gradient.
- **Manus:** clean dark dotted-grid login/invite — centered mark, OAuth buttons, email. Minimal & elegant.

**Common frontier DNA → adopt:** dark + lots of negative space; an elegant **centered greeting** as the empty state (not a big logo); a single rounded **hero input**; **collapsible/hidden side panels** (icon rail + toggle) so chatting is focused; subtle **ambient gradient glow** (never bright/garish); suggestion chips; model selector inside the input; **streaming** replies.

## 10. ★ ACTIVE TASK (do this next — Acung's current request) ★

Redesign Main Chat + Login to feel like Gemini/Claude/Manus/Stitch — elegant, minimal, futuristic — without losing Thunity's identity or governance. Concretely:

1. **Empty / just-logged-in state → elegant & minimal (Gemini-style).** Replace the big bright logo with a **calm centered greeting** (e.g. "Hi founder — what should we tackle today?" / Indonesian-friendly), a single elegant hero input, suggestion chips, and a **very subtle ambient gradient glow** (dark, not norak). The current `.fast-empty-logo` is "too gaudy/bright" — make any mark small & subtle (or drop it for a text greeting).
2. **Hide the dashboards by default; focus on chat.** On a fresh login/empty state, do **NOT** show the left nav + right Founder Insight panel fully. Collapse them. Chat is the focus.
3. **Collapsible LEFT and RIGHT panels via a toggle bar** (like the Claude top-left sidebar toggle). Add a toggle to collapse/expand the left nav (→ thin icon rail or hidden) and a toggle for the right Founder Insight panel. When chatting → both collapsed → distraction-free; expand on demand. Persist the collapsed state (localStorage).
4. **Streaming responses** (frontier feel): make replies stream token-by-token. Backend: add a streaming variant of fast_chat (Ollama `stream:True` → SSE/`StreamingResponse`); ollama_client needs a streaming method. Frontend: consume the stream and append. (Restart `thunity-backend` after.) Keep side-effect-free + honest (still persist the full message + audit at the end).
5. **Add tasteful color & effects** (gradients, glows, motion) studied from the references — but elegant, never garish. Use the palette (blue/teal/purple). Look at how Gemini/Claude use negative space + a single accent.
6. **Apply the same elegant language to Login** (ask-first, minimal, premium).
7. **Verify** in browser (1440/768/390), build green, governance intact, no console errors. Iterate against the references until it feels world-class.

**Suggested order:** (a) collapsible panels + minimal empty state (biggest "focus on chat" win), (b) elegant greeting + subtle ambient glow (fix "norak"), (c) Login polish, (d) streaming (bigger, do last). Multi-pass with browser review each step.

## 11. GOTCHAS / REMINDERS

- Backend has **no `--reload`** → `docker restart thunity-backend` after backend edits.
- `rm -rf frontend/dist` before `npm run build`.
- Preview viewport resets on reload → re-resize.
- CSS source-order: media-query overrides must come AFTER new base rules.
- Keep `thunity-mark.png` for the badges (sidebar/login/avatars need the 30% padding); make hero/watermark variants via mask + size.
- Don't touch `THUWEALTH AI`, `PROJECT AI BUILDING`, `thunity-clean/`. No `docker compose down -v`.
- Acung speaks Indonesian; reply in Indonesian; lead with the thing he emphasized.
- Persistent memory files live at `~/.claude/projects/-Users-aaa-Documents-Claude-Projects-PROJECT-AI-COMPANY/memory/` (auto-loaded next session via `MEMORY.md`). This doc is the long-form companion.
