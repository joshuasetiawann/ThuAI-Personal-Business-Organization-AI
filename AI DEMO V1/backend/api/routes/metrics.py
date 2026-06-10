from fastapi import APIRouter
import psutil
import httpx
from datetime import datetime
from config import settings

router = APIRouter()


@router.get("/system")
async def get_system_metrics():
    cpu = psutil.cpu_percent(interval=0.3)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    net = psutil.net_io_counters()
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "cpu":    {"percent": cpu, "count": psutil.cpu_count()},
        "memory": {
            "percent":      memory.percent,
            "used_gb":      round(memory.used   / (1024**3), 2),
            "total_gb":     round(memory.total  / (1024**3), 2),
            "available_gb": round(memory.available / (1024**3), 2),
        },
        "disk": {
            "percent": disk.percent,
            "used_gb":  round(disk.used  / (1024**3), 2),
            "total_gb": round(disk.total / (1024**3), 2),
        },
        "network": {
            "bytes_sent_mb": round(net.bytes_sent / (1024**2), 2),
            "bytes_recv_mb": round(net.bytes_recv / (1024**2), 2),
        }
    }


@router.get("/services")
async def get_services_status():
    services = {}

    # Cek Ollama
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{settings.OLLAMA_URL}/api/tags")
            data = r.json()
            services["ollama"] = {
                "status": "online",
                "models": [m["name"] for m in data.get("models", [])],
                "url": settings.OLLAMA_URL
            }
    except Exception as e:
        services["ollama"] = {"status": "offline", "error": str(e), "models": []}

    # Cek N8N
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{settings.N8N_URL}/healthz")
            services["n8n"] = {"status": "online"}
    except Exception as e:
        services["n8n"] = {"status": "offline", "error": str(e)}

    return services


@router.get("/ollama/models")
async def get_ollama_models():
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"{settings.OLLAMA_URL}/api/tags")
            return r.json()
    except Exception as e:
        return {"error": str(e), "models": []}
