"""
4-Agent Local AI Council + Evaluator — SEQUENTIAL orchestration.

Stages (never parallel — hardware constraint):
  1 Architect Analyst       → primary analysis
  2 Red Team Critic         → attack stage 1
  3 Pragmatic Exec Engineer → feasibility on real codebase + this hardware
  4 Architect Analyst       → revision given criticism + constraints
  5 Executive Synthesizer   → final structured decision
  6 Evaluator               → JSON rubric score

Everything is persisted: agent_runs, agent_messages (with prompt_version_id,
model, latency), model_usage_logs, evaluations. Optional knowledge grounding.
The only inference path is local Ollama; there is no cloud fallback.
"""
from __future__ import annotations

import json
import time
import uuid
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import select

from config import settings
from agents.ollama_client import ollama
from agents.model_router import role_model_map
from agents import prompts as default_prompts
from core.audit import log_model_usage
from db.models import AgentRun, AgentMessage, PromptVersion, Evaluation


def _est_tokens(text: str) -> int:
    return max(0, len(text or "") // 4)


async def _active_prompt(db, agent_name: str) -> Dict:
    """Return {'id': prompt_version_id|None, 'text': prompt}. DB copy is
    authoritative; falls back to the seeded default if not present."""
    if db is not None:
        res = await db.execute(
            select(PromptVersion).where(
                PromptVersion.agent_name == agent_name, PromptVersion.is_active == True  # noqa: E712
            )
        )
        pv = res.scalars().first()
        if pv is not None:
            return {"id": pv.id, "text": pv.prompt_text}
    return {"id": None, "text": default_prompts.DEFAULTS.get(agent_name, "You are a helpful local AI agent.")}


async def _run_stage(db, run_id, agent_name: str, role_key: str, user_text: str,
                     stage_input: str, temperature: float = 0.7) -> Dict:
    """Run one agent stage via local Ollama, persist an agent_message, return it."""
    prompt = await _active_prompt(db, agent_name)
    model = role_model_map().get(role_key, settings.OLLAMA_MODEL_FAST)
    messages = [
        {"role": "system", "content": prompt["text"]},
        {"role": "user", "content": stage_input},
    ]
    status, content, latency = "ok", "", None
    try:
        result = await ollama.chat(model, messages, temperature=temperature, num_predict=1024)
        content, latency = result["content"], result["latency_ms"]
    except Exception as e:  # Ollama offline / timeout — recorded, never cloud fallback
        status, content = "failed", f"[stage failed: {e}]"

    if db is not None:
        db.add(AgentMessage(
            agent_run_id=run_id, agent_name=agent_name, round=role_key, model=model,
            prompt_version_id=prompt["id"], prompt=stage_input[:8000], response=content,
            token_estimate=_est_tokens(stage_input) + _est_tokens(content),
            latency_ms=latency, status=status,
        ))
        await log_model_usage(db, model=model, agent_name=agent_name, agent_run_id=run_id,
                              latency_ms=latency, token_estimate=_est_tokens(content), status=status)
        await db.flush()
    return {"agent": agent_name, "model": model, "content": content, "status": status, "latency_ms": latency}


async def run_council(
    db, user_message: str, user: Optional[dict] = None, conversation_id=None,
    use_knowledge_base: bool = False, top_k: int = 5, allow_deep: bool = False,
) -> Dict:
    """Execute the full 6-stage council. Returns a structured result dict."""
    t0 = time.time()
    run_id = uuid.uuid4()
    model_map = role_model_map()

    # Optional local knowledge grounding (lazy import to avoid cycles).
    sources: List[Dict] = []
    grounding_note = "No local knowledge source was used. This answer is based on model reasoning only."
    context_block = ""
    if use_knowledge_base and db is not None:
        try:
            from services.knowledge_service import retrieve_context, format_grounding
            sources = await retrieve_context(db, user_message, top_k=top_k)
            if sources:
                context_block = "\n\n[LOCAL KNOWLEDGE CONTEXT]\n" + "\n---\n".join(
                    f"({i+1}) {s['filename']} | trust={s['trust_level']} | "
                    f"status={s['document_status']}\n{s['content_preview']}"
                    for i, s in enumerate(sources)
                )
                grounding_note = format_grounding(sources)
        except Exception as e:
            grounding_note = f"Knowledge retrieval unavailable: {e}"

    # Persist the run shell first so a failed run is still logged.
    if db is not None:
        db.add(AgentRun(
            id=run_id, conversation_id=conversation_id,
            user_id=(uuid.UUID(user["id"]) if user and user.get("id") else None),
            mode="council", user_message=user_message, model_map_json=model_map,
            knowledge_used=bool(sources), status="running",
        ))
        await db.flush()

    base = f"USER REQUEST:\n{user_message}{context_block}"

    # Stage 1 — Architect Analyst
    s1 = await _run_stage(db, run_id, "architect_analyst", "analyst", user_message, base)
    # Stage 2 — Red Team Critic
    s2 = await _run_stage(db, run_id, "red_team_critic", "critic", user_message,
                          f"{base}\n\n[ARCHITECT ANALYST OUTPUT]\n{s1['content']}\n\nAttack this analysis.")
    # Stage 3 — Pragmatic Execution Engineer
    s3 = await _run_stage(db, run_id, "pragmatic_execution_engineer", "execution", user_message,
                          f"{base}\n\n[ANALYST]\n{s1['content']}\n\n[CRITIC]\n{s2['content']}\n\n"
                          "Assess execution feasibility on the founder's hardware and a real codebase.")
    # Stage 4 — Architect Analyst revision
    s4 = await _run_stage(db, run_id, "architect_analyst", "analyst", user_message,
                          f"{base}\n\n[YOUR ANALYSIS]\n{s1['content']}\n\n[CRITIC]\n{s2['content']}\n\n"
                          f"[EXECUTION ENGINEER]\n{s3['content']}\n\nRevise your analysis accordingly.")
    # Stage 5 — Executive Synthesizer
    s5 = await _run_stage(db, run_id, "executive_synthesizer", "synthesizer", user_message,
                          f"USER REQUEST:\n{user_message}\n\n[ANALYST REVISED]\n{s4['content']}\n\n"
                          f"[CRITIC]\n{s2['content']}\n\n[EXECUTION ENGINEER]\n{s3['content']}\n\n"
                          f"Grounding: {grounding_note}\n\nProduce the final structured decision.",
                          temperature=0.4)
    final_response = s5["content"]

    # Stage 6 — Evaluator (JSON). Failure is tolerated; run still saved.
    evaluation = await _run_evaluator(db, run_id, user_message, final_response, grounding_note)

    total_latency = int((time.time() - t0) * 1000)
    overall_status = "completed" if s5["status"] == "ok" else "failed"
    if db is not None:
        res = await db.execute(select(AgentRun).where(AgentRun.id == run_id))
        run = res.scalar_one_or_none()
        if run:
            run.final_response = final_response
            run.status = overall_status
            run.total_latency_ms = total_latency
            run.completed_at = datetime.utcnow()
        await db.flush()

    return {
        "agent_run_id": str(run_id),
        "conversation_id": str(conversation_id) if conversation_id else None,
        "status": overall_status,
        "final_response": final_response,
        "stages": [s1, s2, s3, s4, s5],
        "model_map": model_map,
        "knowledge_used": bool(sources),
        "sources": sources,
        "grounding_note": grounding_note,
        "evaluation": evaluation,
        "total_latency_ms": total_latency,
    }


async def _run_evaluator(db, run_id, user_message: str, final_response: str, grounding_note: str) -> Dict:
    prompt = await _active_prompt(db, "evaluator")
    model = settings.OLLAMA_MODEL_EVALUATOR
    messages = [
        {"role": "system", "content": prompt["text"]},
        {"role": "user", "content": f"USER REQUEST:\n{user_message}\n\nFINAL OUTPUT:\n{final_response}\n\n"
                                    f"Grounding: {grounding_note}\n\nReturn ONLY the JSON rubric."},
    ]
    parsed, status = None, "ok"
    try:
        result = await ollama.chat(model, messages, temperature=0.0, num_predict=512)
        parsed = _extract_json(result["content"])
    except Exception:
        status = "failed"
    if not parsed:
        status = "failed"
        parsed = {"accuracy_score": 0.0, "completeness_score": 0.0, "grounding_score": 0.0,
                  "actionability_score": 0.0, "hallucination_risk": "medium",
                  "major_issues": ["evaluator unavailable"], "improvement_suggestions": []}

    if db is not None:
        db.add(Evaluation(
            agent_run_id=run_id, evaluator_type="self",
            accuracy_score=float(parsed.get("accuracy_score", 0) or 0),
            completeness_score=float(parsed.get("completeness_score", 0) or 0),
            grounding_score=float(parsed.get("grounding_score", 0) or 0),
            actionability_score=float(parsed.get("actionability_score", 0) or 0),
            risk_score=0.0,
            hallucination_risk=str(parsed.get("hallucination_risk", "medium")),
            comments=json.dumps({"major_issues": parsed.get("major_issues", []),
                                 "improvement_suggestions": parsed.get("improvement_suggestions", [])})[:4000],
            status=status,
        ))
        await db.flush()
    parsed["status"] = status
    return parsed


def _extract_json(text: str) -> Optional[dict]:
    if not text:
        return None
    try:
        start, end = text.index("{"), text.rindex("}") + 1
        return json.loads(text[start:end])
    except Exception:
        return None
