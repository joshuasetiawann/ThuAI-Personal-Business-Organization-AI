"""Local sandbox registry (BASIC).

This phase records sandbox-run intent/logs only. It does NOT execute arbitrary
code. Policy for a future executor: no network access, dedicated working dir
under SANDBOX_DIR, hard timeout, read-only access to selected input files,
captured logs + generated artifacts. Documented as a limitation for now."""
from __future__ import annotations
from db.models import SandboxRun

NO_NETWORK = True
DEFAULT_TIMEOUT_SECONDS = 30


async def create_run(db, requested_by: str, task_type: str = "analysis",
                     input_files=None, logs: str = "") -> SandboxRun:
    run = SandboxRun(requested_by=requested_by, task_type=task_type,
                     input_files=input_files or [], status="created", logs=logs)
    db.add(run)
    await db.flush()
    return run
