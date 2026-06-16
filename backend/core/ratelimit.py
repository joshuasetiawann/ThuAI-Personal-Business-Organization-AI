"""In-process login throttle (no external dependency).

The backend runs as a single local uvicorn worker bound to 127.0.0.1, so a
module-level dict is a sufficient and honest rate limiter. Three independent
counters are tracked so a single locked dimension stops an attack:

  • per-(ip, username) — the precise pair (tightest, classic lockout).
  • per-ip             — caps total failures from one IP across MANY usernames
                         (defeats credential-stuffing / username enumeration).
  • per-username       — caps failures against one account from MANY IPs.

Each uses exponential backoff + temporary lockout. State resets on a successful
login or on process restart — adequate for a single-founder, local-first system
where the login is the whole perimeter. No Redis/slowapi dep.
"""
from __future__ import annotations
import time
from threading import Lock

_LOCK = Lock()
_ATTEMPTS: dict[str, dict] = {}     # key -> {"fails": int, "until": float, "seen": float}

# (threshold, base lock seconds) per dimension. The pair is strictest; the broad
# ip/username dimensions allow more before locking so legitimate retries on other
# accounts aren't punished, but still cap a stuffing run.
_DIMS = {
    "pair": (5, 15),
    "ip": (20, 30),
    "user": (10, 30),
}
MAX_FAILS = 5          # kept for back-compat / tests (the pair threshold)
MAX_LOCK_S = 900       # cap at 15 minutes
_FORGET_AFTER = 1800   # drop idle counters after 30 min of no activity


def _ip(ip: str | None) -> str:
    return ip or "?"


def _user(username: str | None) -> str:
    return (username or "").strip().lower()


def _keys(ip: str | None, username: str | None) -> dict[str, str]:
    return {
        "pair": f"pair|{_ip(ip)}|{_user(username)}",
        "ip": f"ip|{_ip(ip)}",
        "user": f"user|{_user(username)}",
    }


def check(ip: str | None, username: str | None) -> tuple[bool, int]:
    """Return (allowed, retry_after_seconds). allowed=False while ANY dimension is locked."""
    now = time.time()
    with _LOCK:
        retry = 0
        for k in _keys(ip, username).values():
            e = _ATTEMPTS.get(k)
            if e and e.get("until", 0) > now:
                retry = max(retry, int(e["until"] - now) + 1)
        return (retry == 0), retry


def record_failure(ip: str | None, username: str | None) -> None:
    now = time.time()
    with _LOCK:
        for dim, k in _keys(ip, username).items():
            threshold, base = _DIMS[dim]
            e = _ATTEMPTS.get(k) or {"fails": 0, "until": 0.0}
            e["fails"] += 1
            e["seen"] = now
            if e["fails"] >= threshold:
                over = e["fails"] - threshold
                e["until"] = now + min(base * (2 ** over), MAX_LOCK_S)
            _ATTEMPTS[k] = e
        # opportunistic cleanup of stale idle entries
        for sk in [s for s, v in _ATTEMPTS.items() if now - v.get("seen", now) > _FORGET_AFTER]:
            _ATTEMPTS.pop(sk, None)


def record_success(ip: str | None, username: str | None) -> None:
    # Clear the pair and the per-account counter (a real login proves the account
    # isn't under a successful guess); leave the per-IP counter to decay so an IP
    # mid-stuffing-run can't reset itself with one known credential.
    with _LOCK:
        ks = _keys(ip, username)
        _ATTEMPTS.pop(ks["pair"], None)
        _ATTEMPTS.pop(ks["user"], None)
