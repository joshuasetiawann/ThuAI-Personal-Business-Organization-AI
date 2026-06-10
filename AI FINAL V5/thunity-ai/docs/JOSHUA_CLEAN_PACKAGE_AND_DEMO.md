# Clean Packaging & Demo Runbook (Acung ↔ Joshua)

## Purpose
Keep the repo clean, package a safe ZIP from Acung's MacBook, and run the frontend demo
on Joshua's Linux PC consistently. Hygiene/workflow only — no app behavior changes.

## Device rule
- **Acung MacBook** = coding + packaging (run cleanup, create the clean ZIP).
- **Joshua Linux PC** = demo server (apply the ZIP, run frontend + backend).
- Joshua's PC has nothing new until Acung sends a fresh ZIP and Joshua applies it.

## On Acung's MacBook

### 1. Preview what cleanup would remove (safe, deletes nothing)
```bash
cd "/Users/aaa/Documents/Claude/Projects/PROJECT AI COMPANY/thunity-ai"
bash scripts/safe_repo_cleanup.sh
```

### 2. Actually clean junk (build dirs, caches, Vite temp files, .DS_Store, root ZIPs)
```bash
bash scripts/safe_repo_cleanup.sh --apply
```

### 3. Create the clean ZIP to send to Joshua
```bash
bash scripts/create_clean_zip.sh            # -> thunity-clean.zip
# or: bash scripts/create_clean_zip.sh thunity-2025-XX-XX.zip
```
`.env.example` is included; the real `.env`, `node_modules`, all `dist*`, caches, and
archives are excluded. The script prints the final ZIP size.

## On Joshua's Linux PC

### 4. Apply the ZIP
```bash
cd "/home/thunity/Desktop/AI/PROJECT AI COMPANY/thunity-ai"
unzip -o thunity-clean.zip -d .
```

### 5. Start the frontend demo (backend must already be running)
```bash
bash scripts/start_frontend_demo.sh
```
Then open the Vite URL it prints in the browser.

### 6. Backend health check
```bash
curl http://127.0.0.1:8000/api/health/local-only
```
Expect `local_only_mode: true`, `status: compliant`, and online database/ollama/n8n.

## Warnings
- **Do NOT package the real `.env`** (the ZIP script already excludes it).
- **Do NOT delete Docker volumes** (`docker compose down -v`, `docker volume rm`, prune).
- **Do NOT reinstall / pull / download models** unless Acung explicitly asks.
- The cleanup script only removes regenerable junk — never source, docs, `.env`, lockfiles, or volumes.

## Troubleshooting
- **Login can't reach backend:** check `curl …/api/health/local-only`; verify the browser
  origin is allowed (dev allows localhost/127.0.0.1 on :5173/:3000) and that
  `frontend/.env` `VITE_API_URL` points at the backend (default `http://localhost:8000`).
- **Frontend build fails:** capture the exact error and stop — do not force-delete or reinstall blindly. Ensure `frontend/node_modules` exists (`npm install` in `frontend/` if missing).
- **Backend health says database offline:** fix the DB config/connection — **do not touch models or volumes**.
