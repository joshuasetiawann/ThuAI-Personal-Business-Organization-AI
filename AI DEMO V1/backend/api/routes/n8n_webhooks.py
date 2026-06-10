"""
N8N Webhook Routes
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, Any
import httpx
from config import settings

router = APIRouter()

class N8NTriggerRequest(BaseModel):
    workflow_name: str
    data: Dict[str, Any] = {}

class DocumentRequest(BaseModel):
    filename: str
    content: str
    format: str = "txt"
    metadata: Dict[str, Any] = {}

@router.post("/trigger")
async def trigger_n8n_workflow(req: N8NTriggerRequest):
    webhook_url = f"{settings.N8N_URL}/webhook/{req.workflow_name}"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(webhook_url, json=req.data)
            return {"success": True, "status_code": r.status_code}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/create-document")
async def n8n_create_document(req: DocumentRequest):
    from services.file_service import file_manager
    return await file_manager.create_document(req.filename, req.content, req.format)

@router.get("/status")
async def n8n_status():
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{settings.N8N_URL}/healthz")
            return {"status": "online", "code": r.status_code}
    except Exception as e:
        return {"status": "offline", "error": str(e)}
