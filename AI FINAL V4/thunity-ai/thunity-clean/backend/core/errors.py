"""Structured error helpers — consistent error contract across the API."""
from __future__ import annotations

from typing import Optional
from fastapi import HTTPException
from fastapi.responses import JSONResponse


def error_payload(code: str, message: str, detail: str = "", suggested_action: str = "") -> dict:
    return {
        "error": True,
        "code": code,
        "message": message,
        "detail": detail,
        "suggested_action": suggested_action,
    }


class AppError(HTTPException):
    """HTTPException carrying the structured error contract in `.detail`."""

    def __init__(self, status_code: int, code: str, message: str,
                 detail: str = "", suggested_action: str = ""):
        super().__init__(status_code=status_code,
                         detail=error_payload(code, message, detail, suggested_action))


def ollama_offline_error(url: str) -> AppError:
    return AppError(
        503, "OLLAMA_OFFLINE", "Ollama service is not reachable.",
        detail=f"Could not reach Ollama at {url}.",
        suggested_action="Run `docker compose up ollama` or check the service logs.",
    )


def model_missing_error(model: str) -> AppError:
    return AppError(
        409, "MODEL_NOT_FOUND", f"Model '{model}' is not installed locally.",
        detail="Models are never auto-downloaded.",
        suggested_action=f"Run manually: ollama pull {model}",
    )
