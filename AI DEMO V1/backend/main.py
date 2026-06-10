"""
AI Ecosystem Backend - Main Application
Multi-Agent System dengan FastAPI + WebSocket
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import asyncio

from api.routes import agents, files, auth, metrics, conversations, n8n_webhooks
from services.websocket_manager import WebSocketManager
from services.database import init_db
from config import settings

app = FastAPI(
    title="AI Ecosystem API",
    description="Multi-Agent AI System dengan Ollama + n8n + Supabase",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket Manager
ws_manager = WebSocketManager()

# Routes
app.include_router(auth.router,           prefix="/api/auth",          tags=["Auth"])
app.include_router(agents.router,         prefix="/api/agents",        tags=["Agents"])
app.include_router(conversations.router,  prefix="/api/conversations",  tags=["Conversations"])
app.include_router(files.router,          prefix="/api/files",          tags=["Files"])
app.include_router(metrics.router,        prefix="/api/metrics",        tags=["Metrics"])
app.include_router(n8n_webhooks.router,   prefix="/api/n8n",           tags=["N8N"])

# ── WebSocket Chat ────────────────────────────────
@app.websocket("/ws/chat/{session_id}")
async def websocket_chat(websocket: WebSocket, session_id: str):
    await ws_manager.connect(websocket, session_id)
    try:
        while True:
            data = await websocket.receive_json()
            await ws_manager.handle_message(websocket, session_id, data)
    except WebSocketDisconnect:
        ws_manager.disconnect(session_id)

# ── WebSocket Monitor ─────────────────────────────
@app.websocket("/ws/monitor")
async def websocket_monitor(websocket: WebSocket):
    await ws_manager.connect_monitor(websocket)
    try:
        while True:
            await asyncio.sleep(3)
            metrics_data = await ws_manager.get_system_metrics()
            await websocket.send_json(metrics_data)
    except WebSocketDisconnect:
        ws_manager.disconnect_monitor(websocket)

# ── Health Check ──────────────────────────────────
@app.get("/api/health")
async def health_check():
    return {"status": "online", "version": "1.0.0"}

@app.get("/")
async def root():
    return {"message": "AI Ecosystem API", "docs": "/api/docs"}

@app.on_event("startup")
async def startup_event():
    try:
        await init_db()
        print("✅ Database initialized")
    except Exception as e:
        print(f"⚠️  Database init warning: {e}")
    print("✅ AI Ecosystem Backend siap!")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

# ── SERVE CHATBOT HTML LANGSUNG ───────────────────────────
from fastapi.responses import HTMLResponse

@app.get("/chatbot", response_class=HTMLResponse)
async def serve_chatbot():
    """Serve chatbot UI langsung dari backend - bypass container nginx"""
    try:
        with open("/app/chatbot.html", "r") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>chatbot.html tidak ditemukan di /app/</h1>")

# ── SERVE CHATBOT HTML LANGSUNG ───────────────────────────
from fastapi.responses import HTMLResponse

@app.get("/chatbot", response_class=HTMLResponse)
async def serve_chatbot():
    """Serve chatbot UI langsung dari backend - bypass container nginx"""
    try:
        with open("/app/chatbot.html", "r") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>chatbot.html tidak ditemukan di /app/</h1>")
