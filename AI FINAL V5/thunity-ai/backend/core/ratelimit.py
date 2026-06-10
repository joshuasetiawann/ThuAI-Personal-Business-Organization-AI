"""In-process login throttle (no external dependency).

The backend runs as a single local uvicorn worker bound to 127.0.0.1, so a
module-level dict is a sufficient and honest rate limiter: a per-(ip, username)
failed-attempt counter with exponential backoff + temporary lockout. State resets
on a successful login or on process restart — adequate for a single-founder,
local-first system where the login is the whole perimeter. No Redis/slowapi dep.
"""
from __future__ import annotations
import time
from threading import Lock

_LOCK = Lock()
_ATTEMPTS: dict[str, dict] = {}     # key -> {"fails": int, "until": float}

MAX_FAILS = 5          # free attempts before lockout starts
BASE_LOCK_S = 15       # first lockout (seconds); doubles each further failure
MAX_LOCK_S = 900       # cap at 15 minutes
_FORGET_AFTER = 1800   # drop idle counters after 30 min of no activity


def _key(ip: str | None, username: str | None) -> str:
    return f"{ip or '?'}|{(username or '').strip().lower()}"


def check(ip: str | None, username: str | None) -> tuple[bool, int]:
    """Return (allowed, retry_after_seconds). allowed=False while locked out."""
    now = time.time()
    with _LOCK:
        e = _ATTEMPTS.get(_key(ip, username))
        if not e:
            return True, 0
        if e.get("until", 0) > now:
            return False, int(e["until"] - now) + 1
        return True, 0


def record_failure(ip: str | None, username: str | None) -> None:
    now = time.time()
    with _LOCK:
        k = _key(ip, username)
        e = _ATTEMPTS.get(k) or {"fails": 0, "until": 0.0}
        e["fails"] += 1
        e["seen"] = now
        if e["fails"] >= MAX_FAILS:
            over = e["fails"] - MAX_FAILS
            e["until"] = now + min(BASE_LOCK_S * (2 ** over), MAX_LOCK_S)
        _ATTEMPTS[k] = e
        # opportunistic cleanup of stale idle entries
        for sk in [s for s, v in _ATTEMPTS.items() if now - v.get("seen", now) > _FORGET_AFTER]:
            _ATTEMPTS.pop(sk, None)


def record_success(ip: str | None, username: str | None) -> None:
    with _LOCK:
        _ATTEMPTS.pop(_key(ip, username), None)
