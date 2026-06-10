"""Hardware-aware model routing + required-model map. Never auto-pulls, never
falls back to cloud. Deep-reasoning (14B) is manual/opt-in only."""
from __future__ import annotations
from typing import Dict, List
from config import settings

HEAVY_MODEL_HINT = "This model may run slowly on RX 6600 XT 8GB and 16GB RAM. " \
                   "Consider using a 7B/8B quantized model for faster local inference."


def select_model(task_type: str, complexity: str = "medium", allow_deep: bool = False) -> str:
    if task_type == "embedding":
        return settings.OLLAMA_MODEL_EMBEDDING
    if task_type == "analyst":
        return settings.OLLAMA_MODEL_ANALYST
    if task_type == "critic":
        return settings.OLLAMA_MODEL_CRITIC
    if task_type == "execution":
        return settings.OLLAMA_MODEL_EXECUTION
    if task_type == "synthesis":
        return settings.OLLAMA_MODEL_SYNTHESIZER
    if task_type == "evaluator":
        return settings.OLLAMA_MODEL_EVALUATOR
    # Only use the heavy 14B model when the caller explicitly opts in.
    if complexity == "high" and allow_deep:
        return settings.OLLAMA_MODEL_DEEP_REASONING
    return settings.OLLAMA_MODEL_FAST


def role_model_map() -> Dict[str, str]:
    return {
        "analyst": settings.OLLAMA_MODEL_ANALYST,
        "critic": settings.OLLAMA_MODEL_CRITIC,
        "execution": settings.OLLAMA_MODEL_EXECUTION,
        "synthesizer": settings.OLLAMA_MODEL_SYNTHESIZER,
        "evaluator": settings.OLLAMA_MODEL_EVALUATOR,
        "embedding": settings.OLLAMA_MODEL_EMBEDDING,
    }


def required_models() -> List[str]:
    # de-duped, deep-reasoning excluded (optional/manual)
    return sorted(set(role_model_map().values()))


def is_heavy(model: str) -> bool:
    m = model.lower()
    return any(tag in m for tag in ["14b", "32b", "70b", "deep"])
