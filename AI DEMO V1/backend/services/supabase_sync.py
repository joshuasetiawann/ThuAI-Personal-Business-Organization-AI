"""
Supabase Sync Service - Sinkronisasi data lokal ke Supabase
"""

import asyncio
import httpx
import json
from datetime import datetime
from typing import Dict, List, Any, Optional
from config import settings


class SupabaseSyncService:
    def __init__(self):
        self.url = settings.SUPABASE_URL
        self.key = settings.SUPABASE_KEY
        self.enabled = bool(self.url and self.key)
        self.headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        }

    def is_configured(self) -> bool:
        return self.enabled

    async def upsert(self, table: str, data: List[Dict] | Dict) -> Dict:
        """Upsert data ke Supabase"""
        if not self.enabled:
            return {"success": False, "error": "Supabase tidak dikonfigurasi"}

        if isinstance(data, dict):
            data = [data]

        url = f"{self.url}/rest/v1/{table}"
        headers = {**self.headers, "Prefer": "resolution=merge-duplicates,return=minimal"}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                r = await client.post(url, headers=headers, json=data)
                if r.status_code in (200, 201, 204):
                    return {"success": True, "table": table, "rows": len(data)}
                return {"success": False, "error": r.text, "status": r.status_code}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def fetch(self, table: str, filters: Optional[Dict] = None) -> List[Dict]:
        """Ambil data dari Supabase"""
        if not self.enabled:
            return []

        url = f"{self.url}/rest/v1/{table}?select=*"
        if filters:
            for k, v in filters.items():
                url += f"&{k}=eq.{v}"

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                r = await client.get(url, headers=self.headers)
                if r.status_code == 200:
                    return r.json()
        except Exception:
            pass
        return []

    async def sync_conversations(self, conversations: List[Dict]) -> Dict:
        """Sync tabel conversations ke Supabase"""
        return await self.upsert("conversations", conversations)

    async def sync_messages(self, messages: List[Dict]) -> Dict:
        """Sync tabel messages ke Supabase"""
        return await self.upsert("messages", messages)

    async def log_agent_activity(self, log_entry: Dict) -> Dict:
        """Log aktivitas agent ke Supabase"""
        return await self.upsert("agent_logs", log_entry)

    async def health_check(self) -> Dict:
        """Cek koneksi ke Supabase"""
        if not self.enabled:
            return {"status": "not_configured", "message": "Set SUPABASE_URL dan SUPABASE_KEY di .env"}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(
                    f"{self.url}/rest/v1/",
                    headers=self.headers
                )
                return {
                    "status": "online" if r.status_code < 400 else "error",
                    "url": self.url,
                    "code": r.status_code
                }
        except Exception as e:
            return {"status": "offline", "error": str(e)}

    async def run_periodic_sync(self, interval_seconds: int = 300):
        """Jalankan sync periodik (setiap 5 menit default)"""
        while True:
            if self.enabled:
                print(f"[SYNC] Menjalankan sinkronisasi Supabase - {datetime.utcnow().isoformat()}")
                # Implementasi sync aktual dari PostgreSQL ke Supabase
                # bisa ditambahkan di sini sesuai kebutuhan
            await asyncio.sleep(interval_seconds)


supabase_sync = SupabaseSyncService()
