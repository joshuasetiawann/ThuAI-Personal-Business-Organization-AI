"""Tool registry — agents may only use registered tools, and execution is gated."""
from __future__ import annotations
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from api.deps import get_db, get_current_user
from tools.registry import list_tools
from tools.executor import execute_tool

router = APIRouter()


class ToolExecuteRequest(BaseModel):
    name: str
    args: dict = {}
    approval_id: str | None = None


@router.get("")
async def tools(user: dict = Depends(get_current_user)):
    return {"tools": list_tools()}


@router.post("/execute")
async def execute(req: ToolExecuteRequest, db=Depends(get_db),
                  user: dict = Depends(get_current_user)):
    res = await execute_tool(db, user, req.name, req.args, req.approval_id)
    await db.commit()
    return res
