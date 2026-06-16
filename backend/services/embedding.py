"""Local embeddings via Ollama (nomic-embed-text by default). No external
embedding provider is ever used. Embeddings run sequentially (hardware)."""
from __future__ import annotations

import math
from typing import List

from agents.ollama_client import ollama


async def embed_text(text: str) -> List[float]:
    return await ollama.embed(text)


async def embed_texts(texts: List[str]) -> List[List[float]]:
    vectors: List[List[float]] = []
    for t in texts:          # sequential — never parallel-hammer the local GPU
        vec = await ollama.embed(t)
        # An empty vector means the embedding model is misconfigured (wrong model
        # name, or a chat model used by mistake). Fail loudly instead of silently
        # storing a dead chunk that can never be retrieved (cosine always 0.0).
        if not vec:
            raise RuntimeError(
                "Embedding model returned an empty vector — check OLLAMA_MODEL_EMBEDDING "
                "(e.g. `ollama pull nomic-embed-text`).")
        vectors.append(vec)
    return vectors


def cosine(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)
