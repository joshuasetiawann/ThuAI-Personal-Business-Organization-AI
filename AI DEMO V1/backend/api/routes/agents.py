"""
Agents API Routes - Endpoint untuk interaksi dengan multi-agent
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Optional
import json
import asyncio
from agents.multi_agent import agent_engine

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    history: List[Dict] = []
    mode: str = "collaborative"  # collaborative | single
    agent_name: Optional[str] = "analyst"
    rounds: int = 2


class SingleAgentRequest(BaseModel):
    agent_name: str
    message: str
    history: List[Dict] = []


@router.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """Stream response dari multi-agent (Server-Sent Events)"""

    async def event_generator():
        try:
            if req.mode == "collaborative":
                async for event in agent_engine.run_collaborative_session(
                    user_message=req.message,
                    conversation_history=req.history,
                    rounds=req.rounds
                ):
                    yield f"data: {json.dumps(event)}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'agent_start', 'agent': req.agent_name})}\n\n"
                full = ""
                async for chunk in agent_engine.single_agent_query(
                    req.agent_name, req.message, req.history
                ):
                    full += chunk
                    yield f"data: {json.dumps({'type': 'chunk', 'agent': req.agent_name, 'content': chunk})}\n\n"
                yield f"data: {json.dumps({'type': 'session_complete'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/health")
async def agents_health():
    """Status kesehatan semua agent dan Ollama"""
    ollama = await agent_engine.check_ollama_health()
    return {
        "agents": {
            "analyst": {"status": "ready", "model": agent_engine.models["analyst"]},
            "critic": {"status": "ready", "model": agent_engine.models["critic"]},
            "synthesizer": {"status": "ready", "model": agent_engine.models["synthesizer"]},
        },
        "ollama": ollama
    }


@router.get("/models")
async def list_models():
    """Daftar model yang tersedia di Ollama"""
    return await agent_engine.check_ollama_health()
