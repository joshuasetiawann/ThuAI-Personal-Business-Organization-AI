"""
File Manager Service - Baca, tulis, modifikasi file lokal
"""

import os
import aiofiles
import json
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
from config import settings


class FileManagerService:
    def __init__(self):
        self.base_dir = Path(settings.FILES_DIR)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.allowed_extensions = {
            '.txt', '.md', '.json', '.csv', '.py', '.js', '.ts',
            '.html', '.css', '.yaml', '.yml', '.xml', '.sql',
            '.pdf', '.docx', '.xlsx', '.png', '.jpg', '.jpeg'
        }

    def _safe_path(self, path: str) -> Path:
        """Pastikan path aman (tidak keluar dari base_dir)"""
        full_path = (self.base_dir / path).resolve()
        if not str(full_path).startswith(str(self.base_dir.resolve())):
            raise PermissionError("Akses ke path ini tidak diizinkan")
        return full_path

    async def list_files(self, subdir: str = "") -> List[Dict]:
        """List semua file di direktori"""
        target = self._safe_path(subdir)
        if not target.exists():
            return []

        result = []
        for item in sorted(target.iterdir()):
            stat = item.stat()
            result.append({
                "name": item.name,
                "path": str(item.relative_to(self.base_dir)),
                "type": "directory" if item.is_dir() else "file",
                "size": stat.st_size if item.is_file() else 0,
                "extension": item.suffix.lower() if item.is_file() else "",
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })
        return result

    async def read_file(self, path: str) -> Dict:
        """Baca konten file"""
        full_path = self._safe_path(path)
        if not full_path.exists():
            raise FileNotFoundError(f"File tidak ditemukan: {path}")

        ext = full_path.suffix.lower()
        if ext not in self.allowed_extensions:
            raise PermissionError(f"Extension {ext} tidak diizinkan untuk dibaca")

        if ext in {'.png', '.jpg', '.jpeg', '.gif'}:
            return {"type": "binary", "path": path, "message": "File gambar, gunakan endpoint download"}

        async with aiofiles.open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = await f.read()

        return {
            "path": path,
            "content": content,
            "size": full_path.stat().st_size,
            "extension": ext
        }

    async def write_file(self, path: str, content: str, create_dirs: bool = True) -> Dict:
        """Tulis/buat file baru"""
        full_path = self._safe_path(path)
        if create_dirs:
            full_path.parent.mkdir(parents=True, exist_ok=True)

        async with aiofiles.open(full_path, 'w', encoding='utf-8') as f:
            await f.write(content)

        return {
            "success": True,
            "path": path,
            "size": full_path.stat().st_size,
            "message": f"File berhasil ditulis: {path}"
        }

    async def create_document(self, filename: str, content: str, doc_type: str = "txt") -> Dict:
        """Buat dokumen bisnis (txt, md, json)"""
        if not filename.endswith(f".{doc_type}"):
            filename = f"{filename}.{doc_type}"

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = f"documents/{timestamp}_{filename}"
        return await self.write_file(path, content)

    async def search_in_files(self, query: str, subdir: str = "") -> List[Dict]:
        """Cari teks dalam file-file"""
        results = []
        target = self._safe_path(subdir)

        for file_path in target.rglob("*"):
            if file_path.is_file() and file_path.suffix in {'.txt', '.md', '.json', '.csv', '.py', '.js'}:
                try:
                    async with aiofiles.open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = await f.read()
                    if query.lower() in content.lower():
                        lines = [
                            (i+1, line) for i, line in enumerate(content.splitlines())
                            if query.lower() in line.lower()
                        ]
                        results.append({
                            "path": str(file_path.relative_to(self.base_dir)),
                            "matches": [{"line": l[0], "content": l[1]} for l in lines[:5]]
                        })
                except Exception:
                    continue

        return results

    def get_dir_info(self) -> Dict:
        """Info direktori utama"""
        total_files = sum(1 for _ in self.base_dir.rglob("*") if _.is_file())
        total_size = sum(f.stat().st_size for f in self.base_dir.rglob("*") if f.is_file())
        return {
            "base_dir": str(self.base_dir),
            "total_files": total_files,
            "total_size_mb": round(total_size / (1024 * 1024), 2)
        }


file_manager = FileManagerService()
