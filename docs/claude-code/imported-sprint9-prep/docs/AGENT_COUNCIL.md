# AI Council

A 4-agent council plus an evaluator, orchestrated **sequentially** by
`agents/council.py`. The only inference path is local Ollama; a failed stage is recorded
as `failed` and never falls back to a cloud model.

## The six stages

1. **Architect Analyst** — primary diagnosis: facts, assumptions, hypotheses, risks,
   initial recommendation.
2. **Red Team Critic** — attacks stage 1: logic flaws, hallucinations, security risks,
   hidden costs, local-only violations, failure modes. Labels findings `[ERROR]` vs
   `[DEBATABLE]`.
3. **Pragmatic Execution Engineer** — feasibility on a real codebase and *this* hardware
   (8GB VRAM, sequential inference, no heavy default).
4. **Architect Analyst (revision)** — revises given the criticism and constraints.
5. **Executive Synthesizer** — final decision-maker; reconciles the prior stages and
   chooses.
6. **Evaluator** — scores the final output as a JSON rubric.

The analyst runs twice (stages 1 and 4), so a completed run persists **5** agent
messages plus 1 evaluation.

## Role → model map

`agents/model_router.role_model_map()` binds each role to a 7B/8B local model (analyst,
critic, execution, synthesizer, evaluator, embedding). See `HARDWARE_PROFILE.md`.

## The decision contract

The Executive Synthesizer prompt forces exactly these labelled sections, in order:
`EXECUTIVE VERDICT`, `DECISION`, `WHY THIS DECISION`, `PRIORITY ACTIONS`, `RISKS`,
`LOCAL-ONLY COMPLIANCE`, `HARDWARE FIT`, `ACCEPTANCE CRITERIA`, `NEXT STEP`. The
Evaluator returns only JSON: `accuracy_score`, `completeness_score`, `grounding_score`,
`actionability_score`, `hallucination_risk`, `major_issues`, `improvement_suggestions`.
`grounding_score` must be low if internal facts are claimed without a cited local source.

## Prompt versioning

Default prompts live in `agents/prompts.py` and are seeded into `prompt_versions` on
bootstrap. **The DB copy is authoritative at runtime** (`_active_prompt`), so prompts can
be versioned and changed without editing code. Each agent message records the
`prompt_version_id` used.

## Persistence and traceability

Every run writes:

- `agent_runs` — `user_message`, `final_response`, `model_map_json`, `knowledge_used`,
  `status`, `total_latency_ms`, timestamps. The run shell is written first, so even a
  failed run is logged.
- `agent_messages` — per stage: `agent_name`, `round` (role key), `model`,
  `prompt_version_id`, prompt, response, `token_estimate`, `latency_ms`, `status`.
- `model_usage_logs` — per stage model usage and latency.
- `evaluations` — the rubric scores and comments.

## Knowledge grounding (optional)

If `use_knowledge_base=true`, the council retrieves local context (see
`RAG_PIPELINE.md`), injects it into the prompts, and produces a `grounding_note`. With no
sources, the note states the answer is "based on model reasoning only."

## API

`POST /api/agents/council` (requires `RUN_ANALYSIS`) — body: `message`,
`conversation_id?`, `use_knowledge_base?`, `top_k?`, `save_as_decision?`,
`create_tasks_from_output?`, `allow_deep_reasoning?`. It ensures a conversation, persists
user + assistant messages, optionally creates a decision/tasks, and audits the run.
`POST /api/agents/single` runs one agent; `GET /api/agents/health` reports Ollama.

## Tests

`test_agent_council.py` covers imports, the 4-agents-plus-evaluator prompt contract,
route auth, local-only model routing, sequential defaults, and a full end-to-end run
with Ollama mocked (asserts run/messages/evaluation persistence and conversation memory).
