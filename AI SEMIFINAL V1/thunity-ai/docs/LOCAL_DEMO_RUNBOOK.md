# Thunity Local AI Company OS — Local Setup & Demo Runbook

> **Core promise: Your company brain stays on your machine.**

This runbook covers local setup, GPU configuration, troubleshooting, data management, and the demo flow for Thunity Local AI Company OS. Written for a new user on a new machine. Safe to include in a GitHub repository — no real secrets, private paths, or personal machine details are included.

---

## 1. What This Project Runs Locally

Thunity Local AI Company OS is a local-first founder command center that includes:

- Frontend Command Center
- Backend API
- PostgreSQL database
- Redis
- n8n workflow engine
- Ollama local model server
- Knowledge Vault, AI Council, Conversations, Decisions, Tasks
- Approval Queue, Workflows Lite, Tools Registry, Audit Trail, System Observatory

**Default local ports:**

| Service   | URL                         |
|-----------|-----------------------------|
| Frontend  | http://localhost:5173        |
| Backend   | http://localhost:8000        |
| n8n       | http://localhost:5678        |
| Ollama    | http://localhost:11434       |
| Postgres  | localhost:5432               |
| Redis     | localhost:6379               |

---

## 2. Safety Rules Before Running

**Never commit:**
- `.env`, `.env.local`, `frontend/.env.local`
- Database dumps with private data
- Docker volume contents
- Ollama model data

**Avoid these destructive commands unless you intentionally want to reset local state:**

```bash
docker compose down -v
docker volume rm ...
docker system prune --volumes
```

These can remove local database state and/or local model storage. Always preserve existing Ollama data — only provision missing models on a first-time machine.

---

## 3. Required Software

Install the following on your local machine:

- Docker & Docker Compose
- Node.js & npm
- Python
- OpenSSL
- curl, unzip, git

**On Arch/Manjaro:**

```bash
sudo pacman -Syu
sudo pacman -S docker docker-compose nodejs npm python python-pip unzip openssl git curl
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

Log out and back in after adding yourself to the `docker` group.

**Verify installation:**

```bash
docker --version && docker compose version
node -v && npm -v
python --version || python3 --version
```

---

## 4. Clone or Extract the Project

**Using Git:**

```bash
git clone <YOUR_REPO_URL> thunity-ai
cd thunity-ai
```

**Using ZIP:**

```bash
unzip thunity-ai.zip
cd thunity-ai
```

**Confirm important files exist:**

```bash
ls docker-compose.yml .env.example backend frontend docs
```

---

## 5. Create `.env`

Copy the example file and generate secrets:

```bash
cp .env.example .env

SECRET_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)
N8N_PASSWORD=$(openssl rand -hex 16)

sed -i "s|SECRET_KEY=.*|SECRET_KEY=$SECRET_KEY|" .env
sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$POSTGRES_PASSWORD|" .env
sed -i "s|N8N_BASIC_AUTH_PASSWORD=.*|N8N_BASIC_AUTH_PASSWORD=$N8N_PASSWORD|" .env
```

Set a founder account for local demo:

```bash
FOUNDER_EMAIL=founder@example.local
FOUNDER_PASSWORD=CHANGE_ME_STRONG_LOCAL_PASSWORD
```

Verify key values:

```bash
grep -E "FOUNDER_EMAIL|FOUNDER_PASSWORD|POSTGRES_PASSWORD|LOCAL_ONLY_MODE|OLLAMA|MODEL" .env
```

**Do not commit `.env`.**

---

## 6. Ollama GPU Setup (AMD ROCm)

If your machine has an AMD GPU, the Ollama service in `docker-compose.yml` must use the ROCm image.

**Correct configuration:**

```yaml
ollama:
  image: ollama/ollama:rocm
  container_name: thunity-ollama
  restart: unless-stopped
  ports:
    - "127.0.0.1:11434:11434"
  devices:
    - /dev/kfd:/dev/kfd
    - /dev/dri:/dev/dri
  volumes:
    - ollama_data:/root/.ollama
  networks:
    - thunity-net
  environment:
    - OLLAMA_HOST=0.0.0.0
    - HSA_OVERRIDE_GFX_VERSION=10.3.0
```

> Use `ollama/ollama:rocm` — not `ollama/ollama:latest:rocm` (invalid tag).

> Do **not** add `group_add: [video, render]` unless your system has the `render` group. This causes a container startup error on machines without it.

**Verify GPU access inside the container:**

```bash
docker exec -it thunity-ollama ls /dev/kfd /dev/dri
```

Expected output:

```
/dev/kfd

/dev/dri:
card1  renderD128
```

**Check if the model is using GPU:**

```bash
docker exec -it thunity-ollama ollama ps
```

- `100% GPU` → GPU is working correctly ✅
- `100% CPU` → GPU not being used; check device mapping and ROCm image
- CPU/GPU split → partial offload; model may be too large for VRAM

---

## 7. Start Docker Services

```bash
docker compose up -d --build
docker compose ps
```

Expected running containers: `backend`, `postgres`, `redis`, `n8n`, `ollama`.

Check with:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

---

## 8. Verify Backend Health

```bash
curl http://localhost:8000/
curl http://localhost:8000/api/health/local-only
```

Expected response indicators:

```
local_only_mode: true
ollama_status: online
database: online
n8n: online
status: compliant
```

---

## 9. Verify Ollama and Local Models

```bash
curl http://localhost:11434/api/tags
```

Or via Docker:

```bash
docker exec -it thunity-ollama ollama list
docker exec -it thunity-ollama ollama ps
```

**Models used in the demo setup:**

| Role              | Model                    |
|-------------------|--------------------------|
| Embedding         | `nomic-embed-text`       |
| Reasoning/Council | `qwen2.5:7b-instruct`    |
| Reasoning/Council | `llama3.1:8b`            |
| Reasoning/Council | `qwen2.5-coder:7b`       |

Model names are controlled by `.env`. Do not delete Ollama volumes or existing models. Only provision missing models on a first-time machine.

---

## 10. Run the Frontend

```bash
cd frontend
npm install
rm -rf dist
npm run build
npm run dev -- --host 0.0.0.0
```

Open: http://localhost:5173

If the frontend cannot reach the backend, create `frontend/.env.local`:

```bash
cat > .env.local <<'EOF'
VITE_API_URL=http://127.0.0.1:8000
EOF
```

Restart the dev server, then hard refresh the browser (`Ctrl + Shift + R`).

---

## 11. Login

Use the founder credentials from `.env`:

```bash
grep -E "^FOUNDER_EMAIL=|^FOUNDER_PASSWORD=" .env
```

Example local-only credentials:

```
Email:    founder@example.local
Password: (value from .env)
```

If the UI shows **"Session expired — please sign in again"**, clear browser storage and reload:

```javascript
localStorage.clear()
sessionStorage.clear()
location.reload()
```

---

## 12. Troubleshooting: Database Password Mismatch

**Symptom in logs:**

```
password authentication failed for user "postgres"
```

**Cause:** A previous PostgreSQL Docker volume exists with an older password. Updating `.env` does not automatically change the password inside the existing volume.

**Fix:**

```bash
grep -E "^POSTGRES_PASSWORD=" .env

docker compose exec postgres psql -U postgres -d postgres -c \
  "ALTER USER postgres WITH PASSWORD '<POSTGRES_PASSWORD_FROM_ENV>';"

docker compose restart backend
sleep 8
curl http://localhost:8000/api/health/local-only
```

Target: `database: online`. This preserves the database volume and does not affect model storage.

---

## 13. Troubleshooting: Missing `tsc` or `vite`

**Symptom:**

```
../typescript/bin/tsc: No such file or directory
../vite/bin/vite.js: No such file or directory
```

**Fix:**

```bash
cd frontend
rm -rf node_modules
npm cache verify
npm install --include=dev --ignore-scripts=false
```

If esbuild install scripts are blocked:

```bash
npm approve-scripts esbuild
npm rebuild esbuild
```

Then rebuild:

```bash
rm -rf dist
npm run build
npm run dev -- --host 0.0.0.0
```

> Do not run `npm audit fix --force` before a demo — it may introduce breaking dependency changes.

---

## 14. View Local Data Safely

Persistent data is stored in Docker volumes:

| Volume          | Contents                        |
|-----------------|---------------------------------|
| `postgres_data` | Main database                   |
| `local_data`    | Backend / n8n file artifacts    |
| `n8n_data`      | n8n state                       |
| `redis_data`    | Redis / cache / queue           |
| `ollama_data`   | Ollama model data               |

List volumes:

```bash
docker volume ls | grep -E "postgres_data|local_data|n8n_data|redis_data|ollama_data"
```

Inspect mount points:

```bash
for v in $(docker volume ls -q | grep -E "postgres_data|local_data|n8n_data|redis_data|ollama_data"); do
  echo "===== $v ====="
  docker volume inspect "$v" --format '{{ .Mountpoint }}'
done
```

Do not manually edit database or model volume contents.

---

## 15. Open PostgreSQL

```bash
docker compose exec postgres psql -U postgres -d thunity_ai
```

**Useful tables:**

```
agent_runs, agent_messages, audit_logs, conversations, messages,
documents, document_chunks, decisions, tasks, workflow_runs,
model_usage_logs, users
```

**Check recent AI Council runs:**

```sql
SELECT
  id, mode, status, knowledge_used, total_latency_ms,
  created_at, completed_at,
  LEFT(user_message, 80) AS prompt,
  LEFT(final_response, 160) AS result
FROM agent_runs
ORDER BY created_at DESC
LIMIT 10;
```

**Check recent messages:**

```sql
SELECT conversation_id, role, LEFT(content, 160) AS content, created_at
FROM messages
ORDER BY created_at DESC
LIMIT 20;
```

**Check documents:**

```sql
SELECT id, filename, status, trust_level, created_at
FROM documents
ORDER BY created_at DESC
LIMIT 20;
```

Exit: `\q`

---

## 16. Export Database Safely

```bash
mkdir -p exports

# Full SQL backup
docker compose exec -T postgres pg_dump -U postgres thunity_ai \
  > exports/thunity_ai_backup_$(date +%F_%H%M).sql

# AI Council runs as CSV
docker compose exec -T postgres psql -U postgres -d thunity_ai -c "\copy (
  SELECT id, mode, status, knowledge_used, total_latency_ms,
         created_at, completed_at, user_message, final_response
  FROM agent_runs ORDER BY created_at DESC
) TO STDOUT WITH CSV HEADER" > exports/agent_runs.csv

# Documents as CSV
docker compose exec -T postgres psql -U postgres -d thunity_ai -c "\copy (
  SELECT id, filename, status, trust_level, created_at
  FROM documents ORDER BY created_at DESC
) TO STDOUT WITH CSV HEADER" > exports/documents.csv

ls -lh exports
```

---

## 17. Demo Flow

Recommended order:

1. Login as founder
2. Dashboard / Founder Daily Briefing
3. Knowledge upload
4. Knowledge search
5. AI Council — without Knowledge Base
6. AI Council — with Knowledge Base enabled
7. Source trust visibility
8. Conversations thread
9. Save as Draft Decision
10. Create Backlog Task
11. Approval Queue
12. Decisions: Mark as Executed
13. Workflows Lite
14. Tools Registry
15. Audit / Observatory

**Demo narration:**

> This is a local-first Founder Command Center. Knowledge enters the local vault, the AI Council reasons using local models, outputs can become draft decisions and backlog tasks, approvals are visible and auditable, decisions can be marked executed in the ledger, low/medium workflows can be triggered, and tools are registry-only. High-risk execution is intentionally held back.

---

## 18. Why AI Council Can Be Slow

AI Council is not a standard chat endpoint. Even a short prompt may run multiple sequential local stages:

```
founder prompt
→ multiple local agents
→ critic / evaluator
→ synthesis
→ audit + conversation save
```

For demo, use a meaningful prompt rather than a one-word test:

```
Buat rekomendasi singkat prioritas kerja Thunity hari ini berdasarkan status sistem lokal.
```

Check if the local model server is working:

```bash
docker exec -it thunity-ollama ollama ps
docker stats --no-stream
docker compose logs --tail=120 backend
docker compose logs --tail=120 ollama
```

---

## 19. Feature Checkpoint

**Demo-ready surfaces:**

- Dashboard / Founder Daily Briefing
- Knowledge Vault upload / search
- AI Council with optional Knowledge Base
- Source Trust Visibility
- Conversations
- Draft Decisions
- Backlog Tasks
- Approval Queue
- Decision Mark as Executed
- Workflows Lite
- Tools Registry
- Audit Trail
- System Observatory

**Intentionally disabled:**

- Full tool execution
- High-risk workflow trigger from UI
- Document verify / deprecate / reindex / delete
- Backup / restore UI
- Arbitrary workflow payloads
- Free-form workflow names or tool args
- Auto-execution and auto-approval

---

## 20. Final Health Checklist

```bash
docker compose ps
curl http://127.0.0.1:8000/
curl http://127.0.0.1:8000/api/health/local-only
cd frontend && npm run build
```

**All targets must pass before demo:**

| Check              | Target       |
|--------------------|--------------|
| Backend            | online       |
| Database           | online       |
| Ollama             | online       |
| n8n                | online       |
| Frontend build     | pass         |
| LOCAL_ONLY_MODE    | true         |
| Status             | compliant    |
| Founder login      | works        |

---

## 21. Things Not to Do Before Demo

Avoid:

- Deleting Docker volumes
- Resetting database without backup
- Removing Ollama model volume
- Re-provisioning models that already exist
- Running `npm audit fix --force`
- Adding new risky features or enabling high-risk workflow triggers
- Adding arbitrary payload editors

**If something breaks, capture logs first:**

```bash
docker compose ps
docker compose logs --tail=120
docker compose logs --tail=120 backend
docker compose logs --tail=120 ollama
docker exec -it thunity-ollama ollama list
```
