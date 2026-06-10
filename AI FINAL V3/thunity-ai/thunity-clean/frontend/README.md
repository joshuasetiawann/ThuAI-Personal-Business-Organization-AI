# Thunity — Founder Command Center (Shot 3, Sprint W1)

Local-first web UI for the Thunity Local AI Company OS backend.

## Run
```bash
cd frontend
cp .env.example .env          # set VITE_API_URL if backend is not on :8000
npm install
npm run dev                   # serves http://localhost:3000 (matches backend CORS)
```
The backend (`thunity-ai/backend`) must be running. Sign in with the founder account
bootstrapped via `FOUNDER_EMAIL` / `FOUNDER_PASSWORD`.

## W1 scope
Read-first: Login, Dashboard (local-only / metrics / hardware / recent audit),
System Observatory preview, Audit Trail. No high-risk execution actions are exposed.
