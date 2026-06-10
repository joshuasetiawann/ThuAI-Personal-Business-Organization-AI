"""Anthropic Claude provider — the OPTIONAL, DECLARED frontier path.

Mirrors the shape of agents.ollama_client so the inference router can treat
local and frontier uniformly: chat() -> {content, latency_ms, model, provider},
chat_stream() -> async generator of text deltas.

Implemented directly on httpx (already a dependency) so no new package needs to
be installed in the running container. Reached ONLY after assert_frontier_allowed()
(key declared). No key ⇒ this client is never invoked and Thunity stays local.
"""
from __future__ import annotations

import json
import time
from typing import AsyncIterator, Dict, List, Tuple

import httpx

from config import settings
from core.local_only import assert_frontier_allowed


def _split_system(messages: List[Dict]) -> Tuple[str, List[Dict]]:
    """Anthropic takes `system` as a top-level string and a user/assistant-only
    message list. Pull system text out, normalise roles, and merge consecutive
    same-role turns so the list strictly alternates (and starts with user)."""
    system_parts: List[str] = []
    convo: List[Dict] = []
    for m in messages:
        role = (m.get("role") or "user").lower()
        content = m.get("content") or ""
        if role == "system":
            if content:
                system_parts.append(content)
            continue
        role = "assistant" if role in ("assistant", "fast_assistant", "model") else "user"
        if convo and convo[-1]["role"] == role:
            convo[-1]["content"] = f"{convo[-1]['content']}\n\n{content}"
        else:
            convo.append({"role": role, "content": content})
    # Anthropic requires the first message to be from the user.
    while convo and convo[0]["role"] != "user":
        convo.pop(0)
    if not convo:
        convo = [{"role": "user", "content": " "}]
    return "\n\n".join(system_parts), convo


class AnthropicClient:
    def __init__(self):
        self.base = settings.ANTHROPIC_BASE_URL.rstrip("/")

    def _headers(self) -> Dict[str, str]:
        return {
            "x-api-key": (settings.ANTHROPIC_API_KEY or "").strip(),
            "anthropic-version": settings.ANTHROPIC_VERSION,
            "content-type": "application/json",
        }

    def _payload(self, model: str, messages: List[Dict], temperature: float,
                 max_tokens: int, stream: bool) -> Dict:
        system, convo = _split_system(messages)
        body: Dict = {
            "model": model,
            "max_tokens": max_tokens or settings.ANTHROPIC_MAX_TOKENS,
            "temperature": temperature,
            "messages": convo,
            "stream": stream,
        }
        if system:
            body["system"] = system
        return body

    async def chat(self, model: str, messages: List[Dict], temperature: float = 0.7,
                   max_tokens: int = 1024) -> Dict:
        """Non-streaming Claude completion. Returns {content, latency_ms, model, provider, usage}."""
        assert_frontier_allowed("anthropic")
        payload = self._payload(model, messages, temperature, max_tokens, stream=False)
        t0 = time.time()
        async with httpx.AsyncClient(timeout=float(settings.ANTHROPIC_TIMEOUT_SECONDS)) as c:
            r = await c.post(f"{self.base}/v1/messages", headers=self._headers(), json=payload)
            if r.status_code >= 400:
                raise RuntimeError(f"Anthropic API error {r.status_code}: {r.text[:300]}")
            data = r.json()
        parts = data.get("content") or []
        content = "".join(b.get("text", "") for b in parts if b.get("type") == "text")
        usage = data.get("usage") or {}
        return {"content": content, "latency_ms": int((time.time() - t0) * 1000),
                "model": model, "provider": "anthropic", "usage": usage}

    async def chat_stream(self, model: str, messages: List[Dict], temperature: float = 0.7,
                          max_tokens: int = 1024) -> AsyncIterator[str]:
        """Stream Claude text deltas. Yields plain text chunks as they arrive."""
        assert_frontier_allowed("anthropic")
        payload = self._payload(model, messages, temperature, max_tokens, stream=True)
        async with httpx.AsyncClient(timeout=float(settings.ANTHROPIC_TIMEOUT_SECONDS)) as c:
            async with c.stream("POST", f"{self.base}/v1/messages",
                                headers=self._headers(), json=payload) as r:
                if r.status_code >= 400:
                    body = await r.aread()
                    raise RuntimeError(f"Anthropic API error {r.status_code}: {body[:300]!r}")
                async for line in r.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    raw = line[5:].strip()
                    if not raw or raw == "[DONE]":
                        continue
                    try:
                        evt = json.loads(raw)
                    except Exception:
                        continue
                    etype = evt.get("type")
                    if etype == "content_block_delta":
                        delta = evt.get("delta") or {}
                        if delta.get("type") in ("text_delta", "text"):
                            text = delta.get("text", "")
                            if text:
                                yield text
                    elif etype == "error":
                        msg = (evt.get("error") or {}).get("message", "stream error")
                        raise RuntimeError(f"Anthropic stream error: {msg}")
                    elif etype == "message_stop":
                        break

    async def health(self) -> Dict:
        """Lightweight readiness: declared + keyed. Avoids spending tokens on a probe."""
        if not settings.frontier_configured:
            return {"status": "disabled", "provider": "anthropic", "model": settings.ANTHROPIC_MODEL}
        return {"status": "configured", "provider": "anthropic", "model": settings.ANTHROPIC_MODEL}


anthropic = AnthropicClient()
