"""
WebSocket Manager - Mengelola koneksi real-time
"""

import asyncio
import json
import psutil
import httpx
from typing import Dict, List, Any
from fastapi import WebSocket
from agents.multi_agent import agent_engine
from config import settings


class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.monitor_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket

    def disconnect(self, session_id: str):
        self.active_connections.pop(session_id, None)

    async def connect_monitor(self, websocket: WebSocket):
        await websocket.accept()
        self.monitor_connections.append(websocket)

    def disconnect_monitor(self, websocket: WebSocket):
        if websocket in self.monitor_connections:
            self.monitor_connections.remove(websocket)

    async def handle_message(self, websocket: WebSocket, session_id: str, data: Dict):
        """Handle incoming WebSocket message dan stream response dari agents"""
        msg_type = data.get("type", "chat")
        message = data.get("message", "")
        history = data.get("history", [])
        mode = data.get("mode", "collaborative")  # collaborative | single
        agent_name = data.get("agent", "analyst")

        try:
            if mode == "collaborative":
                # Multi-agent collaborative session
                async for event in agent_engine.run_collaborative_session(
                    user_message=message,
                    conversation_history=history,
                    rounds=2
                ):
                    await websocket.send_json(event)
            elif mode == "single":
                # Single agent mode
                await websocket.send_json({"type": "agent_start", "agent": agent_name})
                full_response = ""
                async for chunk in agent_engine.single_agent_query(agent_name, message, history):
                    full_response += chunk
                    await websocket.send_json({"type": "chunk", "agent": agent_name, "content": chunk})
                await websocket.send_json({"type": "agent_done", "agent": agent_name, "full_response": full_response})
                await websocket.send_json({"type": "session_complete"})

        except Exception as e:
            await websocket.send_json({"type": "error", "message": str(e)})

    async def get_system_metrics(self) -> Dict[str, Any]:
        """Ambil metrik sistem untuk dashboard"""
        cpu = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')

        # Cek status Ollama
        ollama_status = await agent_engine.check_ollama_health()

        # Cek status N8N
        n8n_status = await self._check_service(settings.N8N_URL)

        return {
            "type": "metrics",
            "system": {
                "cpu_percent": cpu,
                "memory_percent": memory.percent,
                "memory_used_gb": round(memory.used / (1024**3), 2),
                "memory_total_gb": round(memory.total / (1024**3), 2),
                "disk_percent": disk.percent,
                "disk_used_gb": round(disk.used / (1024**3), 2),
            },
            "services": {
                "ollama": ollama_status,
                "n8n": n8n_status,
                "active_sessions": len(self.active_connections),
            }
        }

    async def _check_service(self, url: str) -> Dict:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(url)
                return {"status": "online", "code": resp.status_code}
        except Exception as e:
            return {"status": "offline", "error": str(e)}

    async def broadcast_to_monitors(self, data: Dict):
        for ws in self.monitor_connections:
            try:
                await ws.send_json(data)
            except Exception:
                pass
