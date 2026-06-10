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
- **W14B Fast Chat polish (started):**
  - latest-turn visual exchange: **You → Thunity Assistant**.
  - Conversations link now uses `/conversations?open=<conversation_id>`.
  - removed "models pulled" wording → "required council models visible in Observatory → Local Models."
- **Latest cumulative ZIP:** `w14a-w14b-ui-foundation-cumulative-delta.zip`, containing:
  `frontend/src/index.css`, `frontend/src/components/AppShell.tsx`, `frontend/src/pages/Login.tsx`, `frontend/src/pages/Council.tsx`.
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
- No full multi-turn chat thread UI yet — **W14B shows only the latest Fast Chat turn**.
- Workflows / Approvals deep links (`?open=` / `?focus=`) are **not finished**.
- Joshua must apply the ZIP (and restart) before any of this is visible on the demo PC.
- A few non-brand component classes still use slightly larger radius (future broader CSS pass).
- Repo has accumulated stale `vite.config.ts.timestamp-*.mjs` / `.DS_Store` (cleanup via `scripts/safe_repo_cleanup.sh` on the MacBook).

## 6. Recommended Next Micro-Tasks (in order)
A. Visual QA on MacBook browser (`npm run dev`).
B. If visual is acceptable, send the cumulative ZIP to Joshua.
C. Joshua applies the ZIP and restarts frontend/backend if needed.
D. **W14B Scout 2** — Fast Chat local multi-turn visual thread check (read-only scout first).
E. **W14C** — logo asset wiring, only after a real SVG/PNG is provided (`frontend/public/`).
F. **W14D** — AppShell/Login polish patch, only if visual QA finds issues.

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

Recreate the latest cumulative ZIP if needed:
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
