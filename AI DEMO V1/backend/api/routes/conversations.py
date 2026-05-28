"""
Conversations API Routes
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Optional
router = APIRouter()

class ConversationCreate(BaseModel):
    title: str = "Percakapan Baru"

@router.get("/")
async def list_conversations():
    return {"conversations": [], "total": 0}

@router.post("/")
async def create_conversation(req: ConversationCreate):
    import uuid
    return {"id": str(uuid.uuid4()), "title": req.title, "created_at": "now"}

@router.get("/{conv_id}/messages")
async def get_messages(conv_id: str):
    return {"messages": [], "conversation_id": conv_id}
