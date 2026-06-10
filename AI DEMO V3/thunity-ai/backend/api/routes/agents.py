"""AI Council endpoints (non-streaming, fully persisted)."""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from api.deps import get_db, get_current_user, require_permission
from core.permissions import Perm
from core.errors import AppError
from core.audit import log_audit
from agents.council import run_council, _active_prompt
from agents.ollama_client import ollama
from agents.model_router import role_model_map
from db.models import AgentRun, AgentMessage
from services import conversation_service as cs
from services import decision_service, task_service

router = APIRouter()


class CouncilRequest(BaseModel):
    message: str
    conversation_id: str | None = None
    use_knowledge_base: bool = False
    top_k: int = 5
    save_as_decision: bool = False
    create_tasks_from_output: bool = False
    allow_deep_reasoning: bool = False


class SingleRequest(BaseModel):
    agent_name: str = "architect_analyst"
    message: str
    conversation_id: str | None = None


@router.post("/council")
async def council(req: CouncilRequest, db=Depends(get_db),
                  user: dict = Depends(require_permission(Perm.RUN_ANALYSIS))):
    if not req.message.strip():
        raise AppError(400, "EMPTY_MESSAGE", "message must not be empty.")
    # ensure a conversation
    conv_id = req.conversation_id
    if conv_id:
        conv = await cs.get_conversation(db, conv_id)
        if not conv or not cs.can_access(user, conv):
            raise AppError(403, "FORBIDDEN", "No access to that conversation.")
    else:
        conv = await cs.create_conversation(db, user["id"], req.message[:60])
        conv_id = str(conv.id)

    await cs.add_message(db, conv_id, "user", req.message)
    result = await run_council(db, req.message, user, conversation_id=uuid.UUID(conv_id),
                               use_knowledge_base=req.use_knowledge_base, top_k=req.top_k,
                               allow_deep=req.allow_deep_reasoning)
    await cs.add_message(db, conv_id, "assistant", result["final_response"],
                         agent_name="executive_synthesizer",
                         metadata={"agent_run_id": result["agent_run_id"],
                                   "sources": result["sources"]})

    decision_id = None
    if req.save_as_decision and result["status"] == "completed":
        d = await decision_service.create_decision(
            db, title=req.message[:120], decision_text=result["final_response"],
            summary=result["grounding_note"], conversation_id=conv_id,
            agent_run_id=result["agent_run_id"],
            evidence={"sources": result["sources"], "evaluation": result["evaluation"]},
            created_by=user["email"])
        decision_id = str(d.id)
        if req.create_tasks_from_output:
            await task_service.create_from_decision(db, d, created_by=user["email"])

    await log_audit(db, "agent_run", actor=user["email"], actor_role=user["role"],
                    entity_type="agent_run", entity_id=result["agent_run_id"],
                    metadata={"knowledge_used": result["knowledge_used"], "status": result["status"]})
    await db.commit()
    result["conversation_id"] = conv_id
    result["decision_id"] = decision_id
    return result


@router.post("/single")
async def single_agent(req: SingleRequest, db=Depends(get_db),
                       user: dict = Depends(require_permission(Perm.RUN_ANALYSIS))):
    role_key = {"architect_analyst": "analyst", "red_team_critic": "critic",
                "pragmatic_execution_engineer": "execution",
                "executive_synthesizer": "synthesizer", "evaluator": "evaluator"}.get(req.agent_name, "analyst")
    model = role_model_map().get(role_key)
    prompt = await _active_prompt(db, req.agent_name)
    run = AgentRun(mode="single", user_message=req.message, model_map_json={req.agent_name: model},
                   status="running", user_id=uuid.UUID(user["id"]))
    db.add(run)
    await db.flush()
    status, content, latency = "ok", "", None
    try:
        out = await ollama.chat(model, [{"role": "system", "content": prompt["text"]},
                                        {"role": "user", "content": req.message}])
        content, latency = out["content"], out["latency_ms"]
    except Exception as e:
        status, content = "failed", f"[failed: {e}]"
    db.add(AgentMessage(agent_run_id=run.id, agent_name=req.agent_name, round="single",
                        model=model, prompt_version_id=prompt["id"], prompt=req.message[:4000],
                        response=content, latency_ms=latency, status=status))
    run.final_response, run.status = content, "completed" if status == "ok" else "failed"
    await log_audit(db, "agent_run", actor=user["email"], entity_type="agent_run", entity_id=str(run.id))
    await db.commit()
    return {"agent_run_id": str(run.id), "agent": req.agent_name, "model": model,
            "response": content, "status": run.status}


@router.get("/health")
async def agents_health(user: dict = Depends(get_current_user)):
    oll = await ollama.health()
    return {"agents": list(role_model_map().keys()), "models": role_model_map(), "ollama": oll}
