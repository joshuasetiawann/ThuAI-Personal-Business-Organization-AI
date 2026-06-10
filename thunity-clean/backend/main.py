"""
Thunity Local AI Company OS — backend entrypoint.

A private, local-first AI operating system for company intelligence, decision-
making, knowledge management, task execution, and workflow governance. Core
promise: your company brain stays on your machine. The only inference path is
local Ollama; there is no cloud/external AI provider in the core path.
"""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError, HTTPException
import uvicorn

from config import settings, startup_safety_check
from core.errors import error_payload
from db.base import init_db, session_factory
from api.routes import (
    auth, health, conversations, agents, knowledge, files, datasets, decisions,
    tasks, approvals, workflows, models, metrics, hardware, audit, tools, sandbox,
    settings as settings_route,
)

app = FastAPI(
    title="Thunity Local AI Company OS",
    description="Private, local-first AI operating system. Local-only core; no external AI providers.",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS — strict allowlist from environment, never a wildcard.
# In development we always permit common LOCAL dev frontend origins (localhost /
# 127.0.0.1 on :5173 and :3000) so login works regardless of which local port the
# browser uses. Production stays restricted to ALLOWED_ORIGINS only. No cloud origins.
_DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173",
                "http://localhost:3000", "http://127.0.0.1:3000"]
_cors_origins = (settings.allowed_origins_list if settings.is_production
                 else sorted(set(settings.allowed_origins_list) | set(_DEV_ORIGINS)))
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── routers ──────────────────────────────────────────────────────────
app.include_router(health.router,         prefix="/api/health",        tags=["Health"])
app.include_router(auth.router,           prefix="/api/auth",          tags=["Auth"])
app.include_router(agents.router,         prefix="/api/agents",        tags=["AI Council"])
app.include_router(conversations.router,  prefix="/api/conversations", tags=["Conversations"])
app.include_router(knowledge.router,      prefix="/api/knowledge",     tags=["Knowledge"])
app.include_router(files.router,          prefix="/api/files",         tags=["Files"])
app.include_router(datasets.router,       prefix="/api/datasets",      tags=["Datasets"])
app.include_router(decisions.router,      prefix="/api/decisions",     tags=["Decisions"])
app.include_router(tasks.router,          prefix="/api/tasks",         tags=["Tasks"])
app.include_router(approvals.router,      prefix="/api/approvals",     tags=["Approvals"])
app.include_router(workflows.router,      prefix="/api/workflows",     tags=["Workflows"])
app.include_router(models.router,         prefix="/api/models",        tags=["Models"])
app.include_router(metrics.router,        prefix="/api/metrics",       tags=["Metrics"])
app.include_router(hardware.router,       prefix="/api/hardware",      tags=["Hardware"])
app.include_router(audit.router,          prefix="/api/audit",         tags=["Audit"])
app.include_router(tools.router,          prefix="/api/tools",         tags=["Tools"])
app.include_router(sandbox.router,        prefix="/api/sandbox",       tags=["Sandbox"])
app.include_router(settings_route.router, prefix="/api/settings",      tags=["Settings"])


@app.get("/")
async def root():
    return {"app": "Thunity Local AI Company OS", "local_only_mode": settings.LOCAL_ONLY_MODE,
            "docs": "/api/docs"}


# ── structured error handlers ────────────────────────────────────────
@app.exception_handler(HTTPException)
async def http_exc_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and exc.detail.get("error"):
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(status_code=exc.status_code,
                        content=error_payload("HTTP_ERROR", str(exc.detail)))


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422,
                        content=error_payload("VALIDATION_ERROR", "Request validation failed.",
                                              detail=str(exc.errors())[:1000]))


@app.exception_handler(Exception)
async def generic_handler(request: Request, exc: Exception):
    # Persist the error server-side; never expose the stack trace to the client.
    try:
        sf = session_factory()
        if sf is not None:
            async with sf() as db:
                from core.audit import log_error
                await log_error(db, code="INTERNAL_ERROR", message=str(exc)[:500],
                                detail=type(exc).__name__, path=str(request.url.path))
                await db.commit()
    except Exception:
        pass
    return JSONResponse(status_code=500,
                        content=error_payload("INTERNAL_ERROR", "An internal error occurred.",
                                              suggested_action="Check server logs for details."))


# ── startup ──────────────────────────────────────────────────────────
@app.on_event("startup")
async def on_startup():
    problems = startup_safety_check()
    if settings.is_production and problems:
        raise RuntimeError("Refusing to start in production: " + "; ".join(problems))
    for p in problems:
        print(f"⚠️  {p}")
    ok = await init_db(create_all=True)
    if ok:
        try:
            sf = session_factory()
            async with sf() as db:
                from services.bootstrap import run_bootstrap
                result = await run_bootstrap(db)
                print(f"✅ Bootstrap: {result}")
        except Exception as e:
            print(f"⚠️  Bootstrap warning: {e}")
    print(f"✅ Thunity backend ready. LOCAL_ONLY_MODE={settings.LOCAL_ONLY_MODE} APP_ENV={settings.APP_ENV}")


if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.BACKEND_HOST, port=settings.BACKEND_PORT, reload=True)
