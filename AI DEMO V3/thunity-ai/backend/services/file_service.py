"""Secure local file storage. Blocks path traversal, validates extension/size,
generates a unique file id, keeps the original filename separately, computes a
SHA-256 checksum, and never silently overwrites. Files never leave FILES_DIR."""
from __future__ import annotations

import os
import uuid
import hashlib
from pathlib import Path
from typing import Dict, List

from config import settings

ALLOWED_EXTENSIONS = {
    ".txt", ".md", ".json", ".csv", ".xlsx", ".xls", ".pdf",
    ".docx", ".yaml", ".yml", ".png", ".jpg", ".jpeg",
}


class FileService:
    def __init__(self):
        self.base = Path(settings.FILES_DIR)
        # Tolerant: data volume may not be mounted at import time (tests / pre-compose).
        # Dirs are also created lazily on first write.
        try:
            self.base.mkdir(parents=True, exist_ok=True)
        except OSError:
            pass
        self.max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024

    # ── path safety ──────────────────────────────────────────────
    def safe_path(self, rel: str) -> Path:
        rel = rel or ""
        # Reject obvious traversal markers up front (cross-platform, before resolve).
        if "\\" in rel or rel.startswith("~") or rel.startswith("/") or ".." in rel.split("/"):
            raise PermissionError("Path traversal blocked: invalid path.")
        base = self.base.resolve()
        p = (base / rel).resolve()
        # Containment check via parents (avoids the /files vs /files_evil prefix bug).
        if p != base and base not in p.parents:
            raise PermissionError("Path traversal blocked: access outside FILES_DIR is denied.")
        return p

    @staticmethod
    def sanitize_filename(name: str) -> str:
        name = name or ""
        # Reject (do not silently strip) anything that looks like traversal.
        if "/" in name or "\\" in name or ".." in name or name.startswith("~"):
            raise ValueError("Path traversal blocked: invalid filename.")
        base = os.path.basename(name)
        if not base or base in (".", ".."):
            raise ValueError("Invalid filename.")
        return base

    def ext_ok(self, name: str) -> bool:
        return Path(name).suffix.lower() in ALLOWED_EXTENSIONS

    # ── operations ───────────────────────────────────────────────
    async def save_upload(self, filename: str, content: bytes, subdir: str = "uploads") -> Dict:
        original = self.sanitize_filename(filename)
        ext = Path(original).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise ValueError(f"Extension '{ext or '(none)'}' is not allowed.")
        if len(content) > self.max_bytes:
            raise ValueError(f"File exceeds MAX_UPLOAD_MB ({settings.MAX_UPLOAD_MB} MB).")
        file_id = uuid.uuid4().hex
        target_dir = self.safe_path(subdir)
        target_dir.mkdir(parents=True, exist_ok=True)
        stored = target_dir / f"{file_id}{ext}"   # unique id → never overwrites
        with open(stored, "wb") as f:
            f.write(content)
        return {
            "file_id": file_id,
            "original_filename": original,
            "stored_path": str(stored.relative_to(self.base)),
            "abs_path": str(stored),
            "sha256": hashlib.sha256(content).hexdigest(),
            "size": len(content),
            "ext": ext.lstrip("."),
        }

    def read_bytes(self, rel: str) -> bytes:
        p = self.safe_path(rel)
        if not p.exists():
            raise FileNotFoundError(rel)
        return p.read_bytes()

    def delete(self, rel: str) -> bool:
        p = self.safe_path(rel)
        if p.exists() and p.is_file():
            p.unlink()
            return True
        return False

    def list_files(self, subdir: str = "") -> List[Dict]:
        target = self.safe_path(subdir)
        if not target.exists():
            return []
        out = []
        for item in sorted(target.iterdir()):
            st = item.stat()
            out.append({"name": item.name, "path": str(item.relative_to(self.base)),
                        "type": "dir" if item.is_dir() else "file",
                        "size": st.st_size if item.is_file() else 0})
        return out


file_service = FileService()
