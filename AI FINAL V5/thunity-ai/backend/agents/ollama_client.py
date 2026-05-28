"""Local Ollama client — chat + embeddings + model listing. The ONLY inference
path. No cloud fallback anywhere. Mockable in tests (monkeypatch ollama.chat)."""
from __future__ import annotations
import json
import time
from typing import AsyncIterator, List, Dict
import httpx
from config import settings


class OllamaClient:
    def __init__(self):
        self.url = settings.OLLAMA_URL

    async def list_models(self) -> List[str]:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.get(f"{self.url}/api/tags")
            r.raise_for_status()
            return [m.get("name", "") for m in r.json().get("models", [])]

    async def list_models_detailed(self) -> List[Dict]:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.get(f"{self.url}/api/tags")
            r.raise_for_status()
            return r.json().get("models", [])

    async def health(self) -> Dict:
        try:
            models = await self.list_models()
            return {"status": "online", "models": models, "url": self.url}
        except Exception as e:
            return {"status": "offline", "error": str(e), "models": [], "url": self.url}

    async def chat(self, model: str, messages: List[Dict], temperature: float = 0.7,
                   num_predict: int = 1024) -> Dict:
        """Non-streaming chat. Returns {content, latency_ms, model}."""
        payload = {
            "model": model, "messages": messages, "stream": False,
            "options": {"temperature": temperature, "num_predict": num_predict,
                        "num_ctx": settings.OLLAMA_NUM_CTX},
        }
        t0 = time.time()
        async with httpx.AsyncClient(timeout=float(settings.MAX_AGENT_TIMEOUT_SECONDS)) as c:
            r = await c.post(f"{self.url}/api/chat", json=payload)
            r.raise_for_status()
            data = r.json()
        content = (data.get("message") or {}).get("content", "") or data.get("response", "")
        return {"content": content, "latency_ms": int((time.time() - t0) * 1000),
                "model": model, "provider": "local"}

    async def chat_stream(self, model: str, messages: List[Dict], temperature: float = 0.7,
                          num_predict: int = 1024) -> AsyncIterator[str]:
        """Streaming chat. Yields text chunks as the local model produces them.
        Ollama streams newline-delimited JSON objects (one per token group)."""
        payload = {
            "model": model, "messages": messages, "stream": True,
            "options": {"temperature": temperature, "num_predict": num_predict,
                        "num_ctx": settings.OLLAMA_NUM_CTX},
        }
        async with httpx.AsyncClient(timeout=float(settings.MAX_AGENT_TIMEOUT_SECONDS)) as c:
            async with c.stream("POST", f"{self.url}/api/chat", json=payload) as r:
                r.raise_for_status()
                async for line in r.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        data = json.loads(line)
                    except Exception:
                        continue
                    chunk = (data.get("message") or {}).get("content", "")
                    if chunk:
                        yield chunk
                    if data.get("done"):
                        break

    async def embed(self, text: str, model: str = None) -> List[float]:
        model = model or settings.OLLAMA_MODEL_EMBEDDING
        async with httpx.AsyncClient(timeout=60.0) as c:
            r = await c.post(f"{self.url}/api/embeddings", json={"model": model, "prompt": text})
            r.raise_for_status()
            return r.json().get("embedding", [])


ollama = OllamaClient()
