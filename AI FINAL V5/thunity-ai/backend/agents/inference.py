"""Inference router — local Ollama (default) + optional frontier (Anthropic Claude).

The point of Thunity's hybrid edge is NOT a bigger model; it is the SAME frontier
model answering with the founder's private memory + knowledge injected. This module
only decides WHICH engine runs and runs it uniformly; the memory/knowledge grounding
is assembled by the caller and passed in `messages`.

Every decision is honest and auditable: route() returns the provider, model, and a
human-readable reason, which the API surfaces so the UI can label each answer
"Local" or "Frontier · Claude". Frontier is reachable only when DECLARED (a key is
present); otherwise routing always returns local.
"""
from __future__ import annotations

from typing import AsyncIterator, Dict, List, Optional

from config import settings
from core.local_only import frontier_enabled
from agents.ollama_client import ollama
from agents.anthropic_client import anthropic
from agents.openrouter_client import openrouter
from agents.model_router import select_model

# Heavy intent → escalate to frontier (English + Indonesian, since the founder
# writes Indonesian). Light chit-chat stays on the fast local model.
HEAVY_KEYWORDS = (
    # English
    "strategy", "strategic", "analyze", "analysis", "evaluate", "compare", "plan",
    "roadmap", "decide", "decision", "design", "architecture", "forecast", "financial",
    "legal", "risk", "draft", "write a", "write me", "code", "debug", "refactor",
    "optimize", "research", "summarize the", "explain why", "trade-off", "pros and cons",
    "business case", "proposal", "review",
    # Indonesian
    "strategi", "analisa", "analisis", "evaluasi", "bandingkan", "rencana", "rancang",
    "putuskan", "keputusan", "desain", "arsitektur", "ramalan", "keuangan", "hukum",
    "risiko", "buatkan", "tuliskan", "kode", "perbaiki", "ringkas", "jelaskan kenapa",
    "untung rugi", "proposal", "kajian", "tinjau", "bisnis",
)


def _frontier_name(provider: str) -> str:
    return "Claude" if provider == "anthropic" else "OpenRouter" if provider == "openrouter" else "Frontier"


def _label(provider: str, model: str) -> str:
    if provider in ("anthropic", "openrouter"):
        return f"Frontier · {_frontier_name(provider)}"
    return f"Local · {model}"


def _frontier_route(reason: str) -> Dict:
    """Build a frontier routing dict for whichever provider is active."""
    provider = settings.active_frontier_provider or "anthropic"
    model = settings.active_frontier_model
    return {"provider": provider, "model": model, "frontier": True,
            "label": _label(provider, model), "reason": reason}


def route(message: str, mode: str = "fast", force: Optional[str] = None) -> Dict:
    """Decide the engine for a request.

    force: "local" | "frontier" | None (auto, the default).
    Returns {provider, model, reason, frontier, label}.
    """
    msg = (message or "").strip()

    # No declared key ⇒ always local, no exceptions.
    if not frontier_enabled():
        m = select_model("fast")
        return {"provider": "local", "model": m, "frontier": False, "label": _label("local", m),
                "reason": "Frontier not configured — answered locally."}

    if force == "local":
        m = select_model("fast")
        return {"provider": "local", "model": m, "frontier": False, "label": _label("local", m),
                "reason": "Local model requested."}
    if force == "frontier":
        return _frontier_route(f"Frontier ({_frontier_name(settings.active_frontier_provider)}) requested, "
                               "grounded in your local memory.")

    # Auto routing.
    if not settings.ROUTE_AUTO:
        m = select_model("fast")
        return {"provider": "local", "model": m, "frontier": False, "label": _label("local", m),
                "reason": "Auto-routing off — answered locally."}

    low = msg.lower()
    long_q = len(msg) >= settings.ROUTE_HEAVY_CHAR_THRESHOLD
    kw = next((k for k in HEAVY_KEYWORDS if k in low), None)
    heavy = mode == "council" or long_q or bool(kw)

    if heavy:
        name = _frontier_name(settings.active_frontier_provider)
        if mode == "council":
            reason = f"Strategic council request → {name}, grounded in your local memory + knowledge."
        elif kw:
            reason = f"Heavy intent ('{kw}') → {name}, grounded in your local memory."
        else:
            reason = f"Long/complex request → {name}, grounded in your local memory."
        return _frontier_route(reason)

    m = select_model("fast")
    return {"provider": "local", "model": m, "frontier": False, "label": _label("local", m),
            "reason": "Quick question → fast local model (private, no tokens spent)."}


def _frontier_client(provider: str):
    return openrouter if provider == "openrouter" else anthropic


async def generate(messages: List[Dict], routing: Dict, temperature: float = 0.7,
                   max_tokens: int = 1024) -> Dict:
    """Run a completion on the chosen engine. Returns {content, latency_ms, model, provider}."""
    if routing.get("frontier"):
        return await _frontier_client(routing.get("provider")).chat(
            routing["model"], messages, temperature=temperature, max_tokens=max_tokens)
    out = await ollama.chat(routing["model"], messages, temperature=temperature,
                            num_predict=max_tokens)
    out.setdefault("provider", "local")
    return out


async def generate_stream(messages: List[Dict], routing: Dict, temperature: float = 0.7,
                          max_tokens: int = 1024) -> AsyncIterator[str]:
    """Stream text deltas from the chosen engine (uniform string chunks)."""
    if routing.get("frontier"):
        async for delta in _frontier_client(routing.get("provider")).chat_stream(
                routing["model"], messages, temperature=temperature, max_tokens=max_tokens):
            yield delta
    else:
        async for delta in ollama.chat_stream(routing["model"], messages,
                                              temperature=temperature, num_predict=max_tokens):
            yield delta


async def provider_health() -> Dict:
    """Honest snapshot of all engines for /api/agents/health and the UI."""
    return {
        "local": await ollama.health(),
        "anthropic": await anthropic.health(),
        "openrouter": await openrouter.health(),
        "frontier": {"status": "configured" if frontier_enabled() else "disabled",
                     "provider": settings.active_frontier_provider or None,
                     "model": settings.active_frontier_model if frontier_enabled() else None},
        "frontier_enabled": frontier_enabled(),
        "active_provider": settings.active_frontier_provider or "local",
        "auto_routing": settings.ROUTE_AUTO,
    }
