#!/usr/bin/env python3
"""
Local-only compliance scanner.

Categories:
  - forbidden active dependency  -> ACTIVE use of an external AI/cloud provider (FAILS the check)
  - optional disabled adapter    -> code under adapters/optional/ (allowed; gated by LOCAL_ONLY_MODE)
  - documentation mention        -> a .md/.txt mention (allowed)
  - safe test string             -> a string inside tests/ (allowed)

Exit code 1 if any FORBIDDEN ACTIVE dependency is found.
"""
from __future__ import annotations
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.abspath(os.path.join(HERE, ".."))
SCAN_DIRS = ["backend", "scripts", "docker-compose.yml", ".env.example"]

# Patterns that indicate ACTIVE external use (these FAIL the check).
FORBIDDEN_ACTIVE = [
    r"api\.openai\.com", r"OPENAI_API_KEY", r"ANTHROPIC_API_KEY", r"GOOGLE_API_KEY",
    r"GROQ_API_KEY", r"\bimport\s+openai\b", r"\bfrom\s+openai\b", r"\bimport\s+anthropic\b",
    r"\bfrom\s+anthropic\b", r"\bimport\s+pinecone\b", r"\bimport\s+weaviate\b",
    r"\bimport\s+replicate\b", r"\bimport\s+cohere\b", r"\.supabase\.co", r"create_client\(",
    r"together\.ai", r"api\.groq\.com",
]
# Soft mentions (reported but never fail).
SOFT = ["openai", "anthropic", "gemini", "supabase", "pinecone", "weaviate",
        "replicate", "together", "groq", "langsmith"]

EXCLUDE_DIRS = {"__pycache__", ".git", "node_modules", ".pytest_cache", "alembic"}


def iter_files(base):
    target = os.path.join(PROJECT, base)
    if os.path.isfile(target):
        yield target
        return
    for root, dirs, files in os.walk(target):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for f in files:
            if f.endswith((".py", ".md", ".txt", ".yml", ".yaml", ".env", ".example", ".sh", ".cfg", ".ini")):
                yield os.path.join(root, f)


def categorize(path: str) -> str:
    rel = os.path.relpath(path, PROJECT)
    if os.path.basename(path) == "check-local-only.py":
        return "self"
    if "adapters/optional" in rel.replace("\\", "/"):
        return "optional disabled adapter"
    if rel.endswith((".md", ".txt")):
        return "documentation mention"
    if "/tests/" in rel.replace("\\", "/") or rel.startswith("backend/tests"):
        return "safe test string"
    return "core"


def main() -> int:
    forbidden, optional, docs, tests = [], [], [], []
    forbidden_re = [re.compile(p, re.IGNORECASE) for p in FORBIDDEN_ACTIVE]
    for base in SCAN_DIRS:
        for path in iter_files(base):
            cat = categorize(path)
            if cat == "self":
                continue
            try:
                text = open(path, encoding="utf-8", errors="ignore").read()
            except Exception:
                continue
            rel = os.path.relpath(path, PROJECT)
            for ln, line in enumerate(text.splitlines(), 1):
                for rx in forbidden_re:
                    if rx.search(line):
                        entry = f"{rel}:{ln}: {line.strip()[:100]}"
                        if cat == "core":
                            forbidden.append(entry)
                        elif cat == "optional disabled adapter":
                            optional.append(entry)
                        elif cat == "documentation mention":
                            docs.append(entry)
                        else:
                            tests.append(entry)

    print("== Thunity local-only compliance scan ==")
    print(f"forbidden active dependency : {len(forbidden)}")
    for e in forbidden:
        print("   FORBIDDEN:", e)
    print(f"optional disabled adapter   : {len(optional)}")
    print(f"documentation mention       : {len(docs)}")
    print(f"safe test string            : {len(tests)}")
    if forbidden:
        print("\nFAIL: active external/cloud AI dependency detected in core path.")
        return 1
    print("\nPASS: no forbidden active cloud/AI dependency in core path.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
