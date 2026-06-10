# Hardware Profile

The backend is tuned for a single founder workstation, not a server farm. Every
orchestration default exists to stay within these limits.

## Target machine

| Component | Spec | Config field |
|-----------|------|--------------|
| GPU | Radeon RX 6600 XT, 8GB VRAM (gfx1032) | `HW_GPU_NAME`, `HW_VRAM_GB=8` |
| CPU | AMD Ryzen 7 5800X (8c/16t) | `HW_CPU_NAME` |
| RAM | 16GB | `HW_RAM_GB=16` |

## Model policy: 7B/8B by default

All council roles default to 7B/8B quantized local models so they fit in 8GB VRAM:

- analyst / synthesizer / evaluator / fast: `qwen2.5:7b-instruct`
- critic: `llama3.1:8b`
- execution: `qwen2.5-coder:7b`
- embedding: `nomic-embed-text`

A 14B "deep reasoning" model (`OLLAMA_MODEL_DEEP_REASONING=qwen2.5:14b-instruct`) is
**optional and manual only**. `model_router.select_model()` returns it solely when the
caller passes `complexity="high"` **and** `allow_deep=True`. It is never auto-selected,
and `required_models()` excludes it. `is_heavy()` flags any 14B/32B/70B/deep model so
the API can warn that it "may run slowly on RX 6600 XT 8GB and 16GB RAM."

## Sequential execution

`AGENT_EXECUTION_MODE=sequential` and `MAX_PARALLEL_AGENT_RUNS=1`. The council runs its
six stages one at a time; embeddings are also computed sequentially
(`services/embedding.py`) to avoid hammering the local GPU. Other relevant limits:
`OLLAMA_NUM_CTX=4096`, `MAX_AGENT_TIMEOUT_SECONDS=240`, `MAX_CONTEXT_CHUNKS=5`,
`MAX_UPLOAD_MB=50`.

## Hardware awareness endpoint

`GET /api/hardware/status` (**requires authentication**) returns live `cpu`, `ram`,
`disk` (via `psutil`), the `gpu` profile, `gpu_acceleration_confirmed` (bool), a possible
`warning`, and an `ollama` block listing `missing_models` (required models not yet
installed). `services/hardware.py` does best-effort GPU detection via `rocm-smi` /
`nvidia-smi`.

## Limitations (honest)

- **GPU acceleration is not guaranteed.** ROCm support for gfx1032 (RX 6600 XT) is
  uncertain, and the detection tools are usually absent inside the backend container.
  When acceleration cannot be confirmed, the API returns a CPU-fallback warning:
  multi-agent runs may be slow. `gpu_acceleration_confirmed` will be `false` in that
  case — this is expected, not a bug.
- Models are **never auto-downloaded**. Missing models are surfaced with a manual
  `ollama pull <model>` hint (`GET /api/models/health`).

## Performance note for the web UI

A full AI Council run is **6 sequential stages** (Analyst → Critic → Execution → Analyst
revision → Synthesizer → Evaluator). On Ryzen 7 5800X + RX 6600 XT 8GB + 16GB RAM with
7B/8B models this is typically **~2–4 minutes**, and noticeably slower if Ollama is on CPU
fallback (GPU acceleration on gfx1032 is not guaranteed). The Founder Command Center must
show per-stage progress and must not block the whole UI while a run is in flight.
