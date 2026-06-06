"""OpenRouter provider — OpenAI-compatible frontier path (incl. FREE models).

One key reaches many models; *:free models are large remote models at $0
(rate-limited). Same uniform shape as the local/Anthropic clients so the inference
router treats it identically. Reached ONLY after assert_frontier_allowed().

Honesty note: OpenRouter sends your prompt to a third party (OpenRouter + the
upstream model host); free endpoints may log/train on data. The UI labels every
answer "Frontier · OpenRouter" so this is never hidden.
"""
from __future__ import annotations

import json
import time
from typing import AsyncIterator, Dict, List

import httpx

from config import settings
from core.local_only import assert_frontier_allowed


class OpenRouterClient:
    def __init__(self):
        self.base = settings.OPENROUTER_BASE_URL.rstrip("/")

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {(settings.OPENROUTER_API_KEY or '').strip()}",
            "Content-Type": "application/json",
            # Optional attribution headers OpenRouter recommends (local-only values).
            "HTTP-Referer": "http://localhost",
            "X-Title": "Thunity Local AI Company OS",
        }

    def _payload(self, model: str, messages: List[Dict], temperature: float,
                 max_tokens: int, stream: bool) -> Dict:
        # OpenAI format — system role stays in the message list as-is.
        return {"model": model, "messages": messages, "temperature": temperature,
                "max_tokens": max_tokens, "stream": stream}

    async def chat(self, model: str, messages: List[Dict], temperature: float = 0.7,
                   max_tokens: int = 1024) -> Dict:
        assert_frontier_allowed("openrouter")
        payload = self._payload(model, messages, temperature, max_tokens, stream=False)
        t0 = time.time()
        async with httpx.AsyncClient(timeout=float(settings.OPENROUTER_TIMEOUT_SECONDS)) as c:
            r = await c.post(f"{self.base}/chat/completions", headers=self._headers(), json=payload)
            if r.status_code >= 400:
                raise RuntimeError(f"OpenRouter API error {r.status_code}: {r.text[:300]}")
            data = r.json()
        choices = data.get("choices") or [{}]
        content = ((choices[0] or {}).get("message") or {}).get("content", "") or ""
        return {"content": content, "latency_ms": int((time.time() - t0) * 1000),
                "model": model, "provider": "openrouter", "usage": data.get("usage") or {}}

    async def chat_stream(self, model: str, messages: List[Dict], temperature: float = 0.7,
                          max_tokens: int = 1024) -> AsyncIterator[str]:
        assert_frontier_allowed("openrouter")
        payload = self._payload(model, messages, temperature, max_tokens, stream=True)
        async with httpx.AsyncClient(timeout=float(settings.OPENROUTER_TIMEOUT_SECONDS)) as c:
            async with c.stream("POST", f"{self.base}/chat/completions",
                                headers=self._headers(), json=payload) as r:
                if r.status_code >= 400:
                    body = await r.aread()
                    raise RuntimeError(f"OpenRouter API error {r.status_code}: {body[:300]!r}")
                async for line in r.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    raw = line[5:].strip()
                    if not raw or raw == "[DONE]":
                        if raw == "[DONE]":
                            break
                        continue
                    try:
                        evt = json.loads(raw)
                    except Exception:
                        continue
                    choices = evt.get("choices") or []
                    if not choices:
                        continue
                    delta = (choices[0] or {}).get("delta") or {}
                    piece = delta.get("content")
                    if piece:
                        yield piece

    async def health(self) -> Dict:
        if not settings.openrouter_configured:
            return {"status": "disabled", "provider": "openrouter", "model": settings.OPENROUTER_MODEL}
        return {"status": "configured", "provider": "openrouter", "model": settings.OPENROUTER_MODEL}


openrouter = OpenRouterClient()
