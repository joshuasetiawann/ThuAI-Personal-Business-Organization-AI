# Thunity Local AI Company OS — Backend (Shot 2)

A private, **local-first** AI operating system for company intelligence, decision-
making, knowledge management, task execution, and workflow governance.
**Core promise: your company brain stays on your machine.**

The entire reasoning core runs on local **Ollama** models. There is **no** OpenAI/
Anthropic/Gemini/Supabase/Pinecone/Weaviate path in the core; `LOCAL_ONLY_MODE`
hard-blocks external providers.

## Run (Docker)
```bash
cp .env.example .env          # then edit: set SECRET_KEY, POSTGRES_PASSWORD,
                              # N8N_BASIC_AUTH_PASSWORD, FOUNDER_PASSWORD
docker compose up -d          # starts ollama, postgres, redis, n8n, backend
# pull the local models (never auto-pulled):
docker exec -it thunity-ollama ollama pull qwen2.5:7b-instruct
docker exec -it thunity-ollama ollama pull llama3.1:8b
docker exec -it thunity-ollama ollama pull qwen2.5-coder:7b
docker exec -it thunity-ollama ollama pull nomic-embed-text
```
API docs: http://localhost:8000/api/docs · Health: http://localhost:8000/api/health/local-only

## Run (backend only, local Python)
```bash
cd backend && pip install -r requirements.txt
export POSTGRES_URL="sqlite+aiosqlite:///./thunity.db"   # or a local postgres URL
export SECRET_KEY="$(openssl rand -hex 32)"
export FOUNDER_EMAIL="founder@thunity.local" FOUNDER_PASSWORD="strong-pass"
uvicorn main:app --reload
```

## Test
```bash
cd backend && pytest -q          # runs on a local sqlite db, Ollama is mocked
python ../scripts/check-local-only.py   # fails if any forbidden cloud dependency is active
```

Frontend (Founder Command Center) is intentionally **Shot 3** — not built here.
See `docs/` for architecture, security, RAG, agent council, and operating doctrine.
