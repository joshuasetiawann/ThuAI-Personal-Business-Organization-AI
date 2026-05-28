# Thunity — Linux AMD / ROCm Runbook (Joshua's machine)

This is the **Linux + AMD GPU (ROCm)** workflow. It runs **container Ollama on the
ROCm image** with direct GPU access. **Do not use the Mac workflow here**, and do
not run this on a Mac — the ROCm image needs `/dev/kfd` and `/dev/dri`, which only
exist on a Linux host with AMD drivers.

> Safe by design: no `docker compose down -v`, no volume deletion, no model
> deletion, no automatic model pulls.

---

## 0. Prerequisites (Linux)

- AMD GPU + ROCm-capable drivers; `/dev/kfd` and `/dev/dri` present.
- Docker Engine + the `docker compose` plugin.
- (Optional, for the UI) Node.js 18+.
- The user running Docker typically needs to be in the `render` and `video` groups
  for GPU device access.

Check devices:
```bash
ls -l /dev/kfd /dev/dri
```

---

## 1. The two compose files

- `docker-compose.yml` — base stack. Container Ollama is **profile-gated** (`ollama`)
  and uses the generic `ollama/ollama:latest` image when enabled.
- `docker-compose.rocm.yml` — **override** that swaps Ollama for `ollama/ollama:rocm`
  and grants `/dev/kfd` + `/dev/dri`, plus `HSA_OVERRIDE_GFX_VERSION`.

You must pass **both files** and enable the **`ollama` profile**.

---

## 2. Start (one command)

```bash
cd "<repo root>"
bash scripts/start_thunity_linux_rocm.sh
```

It verifies Docker, checks the GPU devices, ensures `.env` (creates from
`.env.example` and stops for review if missing), then runs:

```bash
docker compose -f docker-compose.yml -f docker-compose.rocm.yml --profile ollama up -d
```

Here the backend talks to the **in-network** container Ollama (`OLLAMA_URL=http://ollama:11434`).

Then it runs a health check and prints URLs.

> If host Ollama (`ollama serve`) is already running on 11434, stop it first so the
> container can bind the port — on Linux you use the **container** Ollama, not host.

---

## 3. GPU version override

`HSA_OVERRIDE_GFX_VERSION=10.3.0` (in `docker-compose.rocm.yml`) is a common value
for RDNA2 cards (e.g. RX 6600 XT). If Ollama logs say the GPU is unsupported, set
the value that matches your card and restart:

```bash
docker compose -f docker-compose.yml -f docker-compose.rocm.yml --profile ollama up -d
```

---

## 4. Models (pull manually — never auto-pulled)

```bash
docker exec -it thunity-ollama ollama pull qwen2.5:7b-instruct
docker exec -it thunity-ollama ollama pull llama3.1:8b
docker exec -it thunity-ollama ollama pull qwen2.5-coder:7b
docker exec -it thunity-ollama ollama pull nomic-embed-text
```

---

## 5. Frontend (optional, separate)

```bash
cd frontend && npm install && npm run dev      # http://localhost:3000
# stale npm modules? -> bash scripts/reset_frontend_deps.sh
```

---

## 6. Health & stop

```bash
bash scripts/check_thunity_health.sh
# stop the stack but KEEP all data/volumes/models:
docker compose -f docker-compose.yml -f docker-compose.rocm.yml stop
```

**Never** run `docker compose down -v` — it would delete the postgres/redis/n8n/
ollama volumes (your data and downloaded models).

---

## 7. Mac vs Linux — do not mix

| | Mac (Acung) | Linux ROCm (Joshua) |
|---|---|---|
| Ollama | **host** Ollama (`ollama serve`) | **container** Ollama (ROCm image) |
| Start script | `start_thunity_mac.command` / `.sh` | `start_thunity_linux_rocm.sh` |
| Compose | base only, no `ollama` profile | base **+** `docker-compose.rocm.yml` **+** `--profile ollama` |
| `OLLAMA_URL` | `http://host.docker.internal:11434` | `http://ollama:11434` |
