# CLAUDE MAX FIRST TASK — ORIENTATION CHECK

Use this as the first task after the YAML handoff is pasted into Claude Max.

```yaml
TASK: "Claude Max onboarding orientation check for Thunity AI"

EXPECTED_LIMIT: "Target 1–3%. Do not implement anything."

IMPORTANT_DEVICE_CONTEXT: >
  This is a fresh Claude Max 20x session. You are receiving the latest Thunity AI project folder/ZIP
  and the YAML operating handoff from the previous Claude workspace. Work is assumed to be on Acung's MacBook
  unless stated otherwise. Joshua is not available right now. No ZIP/sync/demo work is needed.

GOAL: >
  Verify that the uploaded project structure matches the handoff enough to continue safely.
  Do not code yet. Do not broad-scan. Confirm the next required gate and identify any mismatch
  between the handoff and actual repo files.

READ_ONLY:
  - "docs/W14_UI_UX_HANDOFF.md"
  - "frontend/src/pages/Council.tsx"
  - "frontend/src/index.css"
  - "frontend/src/api/client.ts"
  - "frontend/src/App.tsx"
  - "frontend/src/components/AppShell.tsx"
  - "frontend/src/pages/Dashboard.tsx"
  - "frontend/src/pages/Login.tsx"
  - ".gitignore"
  - "scripts/safe_repo_cleanup.sh"
  - "scripts/create_clean_zip.sh"

EDIT_ONLY:
  - "None"

DO_NOT:
  - "Do not edit any files."
  - "Do not implement anything."
  - "Do not broad inspect the repo."
  - "Do not touch backend files."
  - "Do not touch Docker, Ollama, Postgres, Redis, n8n, model, volume, or environment files."
  - "Do not pull, reinstall, download, delete, or reset any models."
  - "Do not change routes, API contracts, auth, dependencies, or UI behavior."
  - "Do not create ZIP/sync/Joshua instructions."
  - "Do not claim visual QA is done."
  - "Do not claim product is visually final."

MAKE_EXACTLY:
  - "Read the YAML handoff first."
  - "Check only the listed files."
  - "Confirm whether the key files exist."
  - "Confirm whether the W14G–W14Q/W14R state appears consistent with the repo."
  - "Confirm whether Fast Chat still appears side-effect free."
  - "Confirm whether AI Council gates appear Council-only."
  - "Confirm whether W14N manual QA is still the required next gate."
  - "List any mismatches or uncertainties."
  - "Do not fix anything yet."

VERIFY:
  - "No build required for this orientation check."
  - "Optional only if quick: cd frontend && npm run build"

REPORT_ONLY:
  - "Files checked"
  - "Repo/handoff consistency"
  - "Confirmed W14 state"
  - "Mismatches or uncertainties"
  - "Governance risk findings"
  - "Whether W14N manual QA is still the next gate"
  - "Recommended first implementation task after orientation"

STOP: true
```
