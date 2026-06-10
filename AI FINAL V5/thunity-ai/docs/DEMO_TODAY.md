# Thunity — Live Demo Run Sheet

Local-only demo. Everything runs on this machine; no cloud.

## 1. Bring up infrastructure
```bash
cd thunity-ai
docker compose up -d            # ollama, postgres, redis, n8n, (backend optional)
docker compose ps              # confirm containers are healthy
```

## 2. Confirm Ollama + models
```bash
curl -s http://localhost:11434/api/tags | grep -o '"name":"[^"]*"'   # list installed models
# If a council/embedding model is missing, pull it manually (no auto-download):
#   ollama pull qwen2.5:7b-instruct
#   ollama pull llama3.1:8b
#   ollama pull qwen2.5-coder:7b
#   ollama pull nomic-embed-text
```
Then in the UI verify under **Observatory → Local Models** that none are "missing".

## 3. Start backend
```bash
cd thunity-ai
# set a real founder + secrets first run:
export APP_ENV=development SECRET_KEY="<strong-random>" \
       FOUNDER_EMAIL="founder@thunity.local" FOUNDER_PASSWORD="<your-password>"
PYTHONPATH=backend python -m uvicorn main:app --host 0.0.0.0 --port 8000
# sanity (optional): python scripts/check-local-only.py
```

## 4. Start frontend
```bash
cd thunity-ai/frontend
rm -rf dist            # clear any stale build dir
cp .env.example .env   # ensure VITE_API_URL=http://localhost:8000
npm install            # first run only
npm run dev            # http://localhost:3000  (matches backend CORS)
```

## 5. Log in
- Open http://localhost:3000 → sign in as the founder account from step 3.

## 6. Demo flow
1. **Dashboard** — Founder Daily Briefing (attention items), local-only badge, hardware status.
2. **Knowledge Vault** — upload a `.txt`/`.md`/`.pdf`; show it appears `indexed + untrusted`.
3. **Knowledge → Search** — query the uploaded content; show trust/relevance/grounding.
4. **AI Council** (Knowledge Base **off**) — ask a question; watch the 6 stages; show synthesis + evaluation + transcript. *(2–4 min on local hardware.)*
5. **AI Council** (Knowledge Base **on**) — re-ask; show the Source grounding card (trust badges + previews).
6. **Conversations** — open the run's conversation; show the persisted transcript.
7. **AI Council → Save as Draft Decision** — confirm; then open **Decisions** to show the draft.
8. **AI Council → Create Task** — confirm; then open **Tasks (Mission Board)** to show the backlog task.
9. **Approvals** — show the pending/critical queue and the founder-only resolve + confirmation-phrase gate (resolve updates status only).
10. **Audit Trail** — show the append-only record (logins, ingest, council runs, approvals).

## Known limitations (say these up front)
- **No execution UI yet** — decisions/tasks can be created and approved, but the underlying action is not executed from the UI.
- **No workflow/tool execution UI** — the registry and governance exist server-side; the UI is read-only here.
- **No document delete / verify / deprecate / reindex UI** — governance mutation flows are not exposed yet.
- **Local models may be slow** — a full Council run is ~2–4 minutes (longer if Ollama is on CPU fallback); the page shows elapsed time and stays responsive.

## If something is offline
- Backend down → pages show an honest "backend unreachable" error (no fake data).
- Ollama down → Council returns a **failed** run with stage errors; knowledge search returns a 503 "local embedding model unavailable". Both are shown truthfully.
