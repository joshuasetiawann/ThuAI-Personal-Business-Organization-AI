"""Structured error helpers — consistent error contract across the API."""
from __future__ import annotations

import uuid
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


def parse_uuid(value, what: str = "id", status_code: int = 404) -> uuid.UUID:
    """Parse a client-supplied UUID. A malformed value raises a structured 404
    (path lookups) or 400 (body/query references) instead of leaking a 500."""
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        if status_code == 400:
            raise AppError(400, "INVALID_ID", f"'{value}' is not a valid {what}.")
        raise AppError(404, "NOT_FOUND", f"No resource found for {what} '{value}'.")


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
