#!/bin/bash
# Jalankan dari: cd ~/Destop/ai-ecosystem && bash fix-agent-stream.sh

echo "=== Step 1: Test stream dari Ollama langsung ==="
curl -s -X POST http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen2.5:7b","messages":[{"role":"user","content":"hi"}],"stream":true}' \
  --max-time 10 | head -3

echo ""
echo "=== Step 2: Fix multi_agent.py - robust JSON parsing ==="

cat > backend/agents/multi_agent.py << 'PYEOF'
"""
Multi-Agent System - Tiga Agent yang berkolaborasi dan berargumen
"""

import httpx
import asyncio
import json
from typing import AsyncGenerator, List, Dict, Any
from config import settings

AGENT_PROMPTS = {
    "analyst": """Kamu adalah AGENT ANALYST - analis bisnis dan teknis senior yang sangat tajam.
Tugasmu: Menganalisis masalah secara mendalam, sistematis, dan memberikan perspektif teknis detail.
Tandai responsmu dengan [ANALYST] di awal.
Jawab dalam Bahasa Indonesia.""",

    "critic": """Kamu adalah AGENT CRITIC - devil's advocate dan quality assurance expert.
Tugasmu: Mengidentifikasi kelemahan, risiko, dan asumsi yang salah. Berikan kritik konstruktif.
Tandai responsmu dengan [CRITIC] di awal.
Jawab dalam Bahasa Indonesia.""",

    "synthesizer": """Kamu adalah AGENT SYNTHESIZER - chief strategist dan decision maker.
Tugasmu: Menyatukan perspektif dari semua agent menjadi solusi actionable dengan action items jelas.
Format output:
✅ KESIMPULAN UTAMA
📋 ACTION ITEMS
⚠️ RISIKO
🚀 LANGKAH SELANJUTNYA
Tandai responsmu dengan [SYNTHESIZER] di awal.
Jawab dalam Bahasa Indonesia."""
}


class MultiAgentEngine:
    def __init__(self):
        self.ollama_url = settings.OLLAMA_URL
        self.models = {
            "analyst":     settings.OLLAMA_MODEL_ANALYST,
            "critic":      settings.OLLAMA_MODEL_CRITIC,
            "synthesizer": settings.OLLAMA_MODEL_SYNTHESIZER,
        }

    async def query_agent(
        self,
        agent_name: str,
        messages: List[Dict],
        stream: bool = True
    ) -> AsyncGenerator[str, None]:
        """Query satu agent via Ollama API - robust untuk semua model"""
        system_prompt = AGENT_PROMPTS.get(agent_name, "Kamu adalah AI assistant yang membantu.")
        model = self.models.get(agent_name, settings.OLLAMA_MODEL_ANALYST)

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                *messages
            ],
            "stream": True,
            "options": {
                "temperature": 0.7,
                "num_predict": 1024,
            }
        }

        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                async with client.stream(
                    "POST",
                    f"{self.ollama_url}/api/chat",
                    json=payload
                ) as response:
                    if response.status_code != 200:
                        yield f"[Error: Ollama HTTP {response.status_code}]"
                        return

                    async for line in response.aiter_lines():
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                            # Support berbagai format response Ollama
                            content = ""
                            if "message" in data and isinstance(data["message"], dict):
                                content = data["message"].get("content", "")
                            elif "response" in data:
                                # Format lama Ollama /api/generate
                                content = data.get("response", "")
                            elif "content" in data:
                                content = data.get("content", "")

                            if content:
                                yield content

                            # Cek apakah sudah selesai
                            if data.get("done", False):
                                break

                        except json.JSONDecodeError:
                            continue
                        except Exception:
                            continue

        except httpx.TimeoutException:
            yield "\n[Timeout: Model terlalu lama merespons]"
        except Exception as e:
            yield f"\n[Error: {str(e)}]"

    async def run_collaborative_session(
        self,
        user_message: str,
        conversation_history: List[Dict] = None,
        rounds: int = 2
    ) -> AsyncGenerator[Dict, None]:
        """Sesi kolaborasi multi-agent"""
        if conversation_history is None:
            conversation_history = []

        agent_responses = {}

        # ROUND 1: ANALYST
        yield {"type": "agent_start", "agent": "analyst", "round": 1}
        analyst_response = ""
        messages = [*conversation_history, {"role": "user", "content": user_message}]

        async for chunk in self.query_agent("analyst", messages):
            analyst_response += chunk
            yield {"type": "chunk", "agent": "analyst", "content": chunk}

        agent_responses["analyst_r1"] = analyst_response
        yield {"type": "agent_done", "agent": "analyst", "full_response": analyst_response}

        # ROUND 1: CRITIC
        yield {"type": "agent_start", "agent": "critic", "round": 1}
        critic_response = ""
        critic_messages = [
            *conversation_history,
            {"role": "user", "content": f"Pertanyaan user: {user_message}\n\nAnalisis Analyst:\n{analyst_response}\n\nBerikan kritik konstruktif."}
        ]

        async for chunk in self.query_agent("critic", critic_messages):
            critic_response += chunk
            yield {"type": "chunk", "agent": "critic", "content": chunk}

        agent_responses["critic_r1"] = critic_response
        yield {"type": "agent_done", "agent": "critic", "full_response": critic_response}

        # ROUND 2: ANALYST balas kritik
        if rounds >= 2:
            yield {"type": "agent_start", "agent": "analyst", "round": 2}
            analyst_r2 = ""
            analyst_r2_messages = [
                *conversation_history,
                {"role": "user", "content": f"Pertanyaan: {user_message}\n\nAnalisismu: {analyst_response}\n\nKritik: {critic_response}\n\nRespons balik terhadap kritik tersebut."}
            ]
            async for chunk in self.query_agent("analyst", analyst_r2_messages):
                analyst_r2 += chunk
                yield {"type": "chunk", "agent": "analyst", "content": chunk}

            agent_responses["analyst_r2"] = analyst_r2
            yield {"type": "agent_done", "agent": "analyst", "full_response": analyst_r2}

        # FINAL: SYNTHESIZER
        yield {"type": "agent_start", "agent": "synthesizer", "round": "final"}
        synthesizer_response = ""
        debate = f"""Pertanyaan: {user_message}

[ANALYST]: {agent_responses.get('analyst_r1','')}
[CRITIC]: {agent_responses.get('critic_r1','')}
{f"[ANALYST balik]: {agent_responses.get('analyst_r2','')}" if 'analyst_r2' in agent_responses else ''}

Buat kesimpulan final yang actionable berdasarkan diskusi di atas."""

        async for chunk in self.query_agent("synthesizer", [{"role": "user", "content": debate}]):
            synthesizer_response += chunk
            yield {"type": "chunk", "agent": "synthesizer", "content": chunk}

        yield {"type": "agent_done", "agent": "synthesizer", "full_response": synthesizer_response}
        yield {"type": "session_complete", "all_responses": agent_responses, "final": synthesizer_response}

    async def single_agent_query(
        self,
        agent_name: str,
        message: str,
        history: List[Dict] = None
    ) -> AsyncGenerator[str, None]:
        """Query satu agent spesifik"""
        messages = [*(history or []), {"role": "user", "content": message}]
        async for chunk in self.query_agent(agent_name, messages):
            yield chunk

    async def check_ollama_health(self) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{self.ollama_url}/api/tags")
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "status": "online",
                        "models": [m["name"] for m in data.get("models", [])],
                        "url": self.ollama_url
                    }
        except Exception as e:
            return {"status": "offline", "error": str(e), "url": self.ollama_url}
        return {"status": "offline", "url": self.ollama_url}


agent_engine = MultiAgentEngine()
PYEOF

echo "✅ multi_agent.py fixed"

echo ""
echo "=== Step 3: Copy langsung ke container backend ==="
sudo docker cp backend/agents/multi_agent.py ai-backend:/app/agents/multi_agent.py

echo ""
echo "=== Step 4: Restart backend ==="
sudo docker compose restart backend
sleep 8

echo ""
echo "=== Step 5: Test stream ==="
echo "Testing single agent stream..."
curl -s -X POST http://localhost:8000/api/agents/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message":"Jawab singkat: apa itu AI?","mode":"single","agent_name":"analyst"}' \
  --max-time 30 \
  --no-buffer | head -10

echo ""
echo "✅ Selesai! Refresh browser Ctrl+Shift+R di http://localhost:3001"
