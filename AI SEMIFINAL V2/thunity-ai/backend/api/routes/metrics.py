"""System metrics + observability aggregations (real data only)."""
from __future__ import annotations
from datetime import datetime
import psutil
from fastapi import APIRouter, Depends
from api.deps import get_db, get_current_user, require_permission
from core.permissions import Perm
from services import metrics_service
from services.hardware import hardware_status

router = APIRouter()


@router.get("/system")
async def system_metrics(user: dict = Depends(get_current_user)):
    return {"timestamp": datetime.utcnow().isoformat(), "hardware": hardware_status()}


@router.get("/overview")
async def overview(db=Depends(get_db), user: dict = Depends(require_permission(Perm.READ_DASHBOARD))):
    return await metrics_service.overview(db)


@router.get("/models")
async def models(db=Depends(get_db), user: dict = Depends(require_permission(Perm.READ_DASHBOARD))):
    return await metrics_service.models(db)


@router.get("/agents")
async def agents(db=Depends(get_db), user: dict = Depends(require_permission(Perm.READ_DASHBOARD))):
    return await metrics_service.agents(db)


@router.get("/knowledge")
async def knowledge(db=Depends(get_db), user: dict = Depends(require_permission(Perm.READ_DASHBOARD))):
    return await metrics_service.knowledge(db)


@router.get("/workflows")
async def workflows(db=Depends(get_db), user: dict = Depends(require_permission(Perm.READ_DASHBOARD))):
    return await metrics_service.workflows(db)
