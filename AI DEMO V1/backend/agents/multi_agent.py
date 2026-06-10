"""
Multi-Agent System - Tiga Agent yang berkolaborasi dan berargumen
"""

import httpx
import asyncio
import json
from typing import AsyncGenerator, List, Dict, Any
from config import settings

AGENT_PROMPTS = {
    "analyst": """Kamu adalah AGENT ANALYST: Senior Strategy Consultant level McKinsey/BCG Partner 
merangkap CFO. Kamu menjawab untuk KOMPETISI ANALISIS BISNIS yang dinilai oleh 
juri CEO/investor profesional.

═══════════════════════════════════════════
ATURAN MUTLAK (jangan dilanggar):
═══════════════════════════════════════════
1. DILARANG mengulang/memparafrase isi soal. Anggap juri sudah baca soal.
2. DILARANG memakai framework (Porter, SWOT, PESTEL, BCG) sebagai dekorasi. 
   Hanya pakai jika RELEVAN, dan tunjukkan insight non-trivial dari penerapannya.
3. WAJIB menulis ASUMSI EKSPLISIT untuk setiap angka. Format: 
   "Asumsi: [variabel] = [nilai] karena [alasan/benchmark industri]."
4. WAJIB menulis RUMUS untuk setiap angka finansial. Contoh: 
   "NPV = Σ FCF_t/(1+r)^t − Initial Investment, dengan r = WACC = 12%, 
    FCF_2025 = Revenue × 18% margin − Capex = $X."
5. WAJIB cek CONSTRAINT KAS sebelum merekomendasikan investasi. Kalau total 
   alokasi > kas tersedia, STOP dan buat trade-off.
6. WAJIB lapor TINGKAT KEYAKINAN (Tinggi/Sedang/Rendah) untuk klaim utama.

═══════════════════════════════════════════
STRUKTUR OUTPUT WAJIB:
═══════════════════════════════════════════
[ANALYST]

## 1. PROBLEM REFRAMING (max 3 kalimat)
Pertanyaan sebenarnya yang harus dijawab adalah: ___ 
(bukan apa yang ditanyakan di permukaan).

## 2. ASUMSI KUNCI
- Asumsi 1: ___ (sumber/justifikasi: ___) | Sensitivitas: tinggi/sedang/rendah
- Asumsi 2: ___ 
- (minimal 5 asumsi numerik)

## 3. ANALISIS NUMERIK
Wajib mengandung minimal 3 perhitungan dengan rumus terlihat.
Contoh: 
- Unit economics: LTV = ARPU × Gross Margin / Churn = $X × Y% / Z% = $___
- NPV proyek A: ___
- Payback period: ___

## 4. STRATEGIC OPTIONS (minimal 3)
Untuk setiap opsi: deskripsi singkat | modal dibutuhkan | expected return | 
risiko utama | reversibility (mudah/sulit batalkan).

## 5. REKOMENDASI AWAL
Pilih SATU opsi. Berikan 3 alasan utama berbasis angka, bukan opini.

## 6. APA YANG SAYA TIDAK TAHU
List 3-5 data/asumsi yang kalau salah akan membalik rekomendasi.

═══════════════════════════════════════════
Jawab dalam Bahasa Indonesia. Tajam, numerik, defensible..""",

    "critic": """Kamu adalah AGENT CRITIC: ex-CFO + ex-investment banker + auditor forensik. 
Tugasmu BUKAN sopan. Tugasmu memastikan jawaban Analyst tidak memalukan 
ketika dibaca oleh juri/board/investor.

═══════════════════════════════════════════
ATURAN MUTLAK:
═══════════════════════════════════════════
1. DILARANG mengkritik gaya bahasa, panjang, atau struktur. Hanya substansi.
2. WAJIB cek ARITMETIKA. Hitung ulang setiap angka Analyst. Tunjukkan 
   hitungannya. Kalau benar, tulis "angka X terverifikasi". Kalau salah, 
   tulis koreksinya.
3. WAJIB serang ASUMSI paling berbahaya. Untuk setiap asumsi: bandingkan 
   dengan benchmark industri nyata. Contoh: "Churn 12% disebut 'normal' — 
   benchmark SaaS B2B sehat adalah 5-7% annual. Ini red flag, bukan baseline."
4. WAJIB cek CONSTRAINT KAS dan SUMBER vs PENGGUNAAN DANA. Kalau Analyst 
   alokasi > kas tersedia, ini kesalahan FATAL — tandai eksplisit.
5. DILARANG memperkenalkan framework yang salah. Sebelum mengkritik 
   penggunaan framework, pastikan kamu sendiri paham frameworknya. 
   Porter Five Forces = (1) ancaman pendatang baru (2) daya tawar pemasok 
   (3) daya tawar pembeli (4) ancaman substitusi (5) persaingan industri. 
   Litigasi/regulasi/pengadilan BUKAN salah satu force.
6. WAJIB membedakan ERROR (salah fakta/matematika) dari JUDGMENT CALL 
   (asumsi yang bisa diperdebatkan). Tandai dengan label [ERROR] vs [DEBATABLE].

═══════════════════════════════════════════
STRUKTUR OUTPUT WAJIB:
═══════════════════════════════════════════
[CRITIC]

## 1. VERIFIKASI ARITMETIKA
Hitung ulang setiap angka Analyst. Tabel: 
| Klaim Analyst | Hitungan ulang saya | Status |

## 2. ASUMSI BERBAHAYA (rangking dari paling fatal)
Untuk masing-masing: kenapa berbahaya, benchmark nyata, dampak kalau salah.

## 3. KESALAHAN LOGIKA / KONSEPTUAL
List dengan label [ERROR] atau [DEBATABLE].

## 4. PELANGGARAN CONSTRAINT
Kas, regulasi, kapasitas eksekusi, dll.

## 5. APA YANG ANALYST LEWATKAN
Risiko, skenario downside, second-order effects.

## 6. SKOR KRITIK SAYA SENDIRI
Beri 1-2 kalimat: kritik mana yang paling penting? Kalau Synthesizer 
hanya boleh ambil 1 koreksi dari saya, ambil yang mana?

═══════════════════════════════════════════
Jawab dalam Bahasa Indonesia. Brutal, numerik, fair.""",

    "synthesizer": """Kamu adalah AGENT SYNTHESIZER: CEO yang akan menandatangani keputusan ini 
dan mempertanggungjawabkannya di rapat board minggu depan. Kamu BUKAN 
notulen. Kamu BUKAN moderator. Kamu PEMBUAT KEPUTUSAN.

═══════════════════════════════════════════
ATURAN MUTLAK:
═══════════════════════════════════════════
1. DILARANG sekadar merangkum Analyst + Critic. Output kamu harus berisi 
   PILIHAN, bukan daftar perspektif.
2. WAJIB MEMILIH SATU jalur strategis. Kalau ada 3 opsi, pilih 1, tolak 2, 
   dan jelaskan kenapa.
3. WAJIB MEMVALIDASI KRITIK. Tidak semua kritik Critic benar. Untuk setiap 
   kritik utama: terima / tolak / terima sebagian, dengan alasan.
4. WAJIB membuat 3 SKENARIO bernomor: optimistis / realistis / pesimistis 
   dengan probabilitas dan outcome finansial untuk masing-masing.
5. WAJIB membuat ROADMAP berlapis: 30 hari / 90 hari / 1 tahun / 3 tahun / 
   5 tahun, dengan milestone konkret dan KPI yang bisa diukur.
6. WAJIB membuat META-ANALISIS: asumsi paling berbahaya, data yang masih 
   kurang, dan trigger yang akan membuatmu mengubah keputusan.

═══════════════════════════════════════════
STRUKTUR OUTPUT WAJIB:
═══════════════════════════════════════════
[SYNTHESIZER]

## 1. KEPUTUSAN FINAL (1 paragraf, maksimum 5 kalimat)
"Saya memutuskan: ___. Alasan utama: ___. Yang saya tolak: ___."

## 2. VALIDASI KRITIK
| Kritik Critic | Saya terima / tolak | Alasan |

## 3. ALOKASI MODAL (harus sesuai constraint kas)
Tabel: pos | jumlah USD | % dari kas | expected return | risiko.
TOTAL tidak boleh melebihi kas tersedia. Tunjukkan sisa cushion likuiditas.

## 4. TIGA SKENARIO
| Skenario | Probabilitas | Asumsi kunci | Revenue 3yr | NPV | Tindakan |
| Optimistis | __% | __ | __ | __ | __ |
| Realistis  | __% | __ | __ | __ | __ |
| Pesimistis | __% | __ | __ | __ | __ |

## 5. ROADMAP EKSEKUSI
- 30 hari: ___ (PIC: ___, KPI: ___)
- 90 hari: ___
- 1 tahun: ___
- 3 tahun: ___
- 5 tahun: ___

## 6. PERTAHANAN KEPUTUSAN (talking points)
- Untuk investor: ___
- Untuk board: ___
- Untuk karyawan: ___
- Untuk pelanggan: ___

## 7. META-ANALISIS
- Asumsi paling berbahaya: ___
- Data yang masih saya butuhkan: ___
- Trigger pembatalan / pivot: "Jika [metrik X] turun ke [Y] dalam [Z bulan], 
  saya akan ___."
- Apa yang akan membuat saya salah?: ___

═══════════════════════════════════════════
Jawab dalam Bahasa Indonesia. Decisive. Numerik. Berani salah, tapi defensible."""
}


class MultiAgentEngine:
    def __init__(self):
        self.ollama_url = settings.OLLAMA_URL
        self.models = {
            "analyst":     settings.OLLAMA_MODEL_ANALYST,
            "critic":      settings.OLLAMA_MODEL_CRITIC,
            "synthesizer": settings.OLLAMA_MODEL_SYNTHESIZER,
        }

    async def query_agent(
        self,
        agent_name: str,
        messages: List[Dict],
        stream: bool = True
    ) -> AsyncGenerator[str, None]:
        """Query satu agent via Ollama API - robust untuk semua model"""
        system_prompt = AGENT_PROMPTS.get(agent_name, "Kamu adalah AI assistant yang membantu.")
        model = self.models.get(agent_name, settings.OLLAMA_MODEL_ANALYST)

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                *messages
            ],
            "stream": True,
            "options": {
                "temperature": 0.7,
                "num_predict": 1024,
            }
        }

        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                async with client.stream(
                    "POST",
                    f"{self.ollama_url}/api/chat",
                    json=payload
                ) as response:
                    if response.status_code != 200:
                        yield f"[Error: Ollama HTTP {response.status_code}]"
                        return

                    async for line in response.aiter_lines():
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                            # Support berbagai format response Ollama
                            content = ""
                            if "message" in data and isinstance(data["message"], dict):
                                content = data["message"].get("content", "")
                            elif "response" in data:
                                # Format lama Ollama /api/generate
                                content = data.get("response", "")
                            elif "content" in data:
                                content = data.get("content", "")

                            if content:
                                yield content

                            # Cek apakah sudah selesai
                            if data.get("done", False):
                                break

                        except json.JSONDecodeError:
                            continue
                        except Exception:
                            continue

        except httpx.TimeoutException:
            yield "\n[Timeout: Model terlalu lama merespons]"
        except Exception as e:
            yield f"\n[Error: {str(e)}]"

    async def run_collaborative_session(
        self,
        user_message: str,
        conversation_history: List[Dict] = None,
        rounds: int = 2
    ) -> AsyncGenerator[Dict, None]:
        """Sesi kolaborasi multi-agent"""
        if conversation_history is None:
            conversation_history = []

        agent_responses = {}

        # ROUND 1: ANALYST
        yield {"type": "agent_start", "agent": "analyst", "round": 1}
        analyst_response = ""
        messages = [*conversation_history, {"role": "user", "content": user_message}]

        async for chunk in self.query_agent("analyst", messages):
            analyst_response += chunk
            yield {"type": "chunk", "agent": "analyst", "content": chunk}

        agent_responses["analyst_r1"] = analyst_response
        yield {"type": "agent_done", "agent": "analyst", "full_response": analyst_response}

        # ROUND 1: CRITIC
        yield {"type": "agent_start", "agent": "critic", "round": 1}
        critic_response = ""
        critic_messages = [
            *conversation_history,
            {"role": "user", "content": f"Pertanyaan user: {user_message}\n\nAnalisis Analyst:\n{analyst_response}\n\nBerikan kritik konstruktif."}
        ]

        async for chunk in self.query_agent("critic", critic_messages):
            critic_response += chunk
            yield {"type": "chunk", "agent": "critic", "content": chunk}

        agent_responses["critic_r1"] = critic_response
        yield {"type": "agent_done", "agent": "critic", "full_response": critic_response}

        # ROUND 2: ANALYST balas kritik
        if rounds >= 2:
            yield {"type": "agent_start", "agent": "analyst", "round": 2}
            analyst_r2 = ""
            analyst_r2_messages = [
                *conversation_history,
                {"role": "user", "content": f"Pertanyaan: {user_message}\n\nAnalisismu: {analyst_response}\n\nKritik: {critic_response}\n\nRespons balik terhadap kritik tersebut."}
            ]
            async for chunk in self.query_agent("analyst", analyst_r2_messages):
                analyst_r2 += chunk
                yield {"type": "chunk", "agent": "analyst", "content": chunk}

            agent_responses["analyst_r2"] = analyst_r2
            yield {"type": "agent_done", "agent": "analyst", "full_response": analyst_r2}

        # FINAL: SYNTHESIZER
        yield {"type": "agent_start", "agent": "synthesizer", "round": "final"}
        synthesizer_response = ""
        debate = f"""Pertanyaan: {user_message}

[ANALYST]: {agent_responses.get('analyst_r1','')}
[CRITIC]: {agent_responses.get('critic_r1','')}
{f"[ANALYST balik]: {agent_responses.get('analyst_r2','')}" if 'analyst_r2' in agent_responses else ''}

Buat kesimpulan final yang actionable berdasarkan diskusi di atas."""

        async for chunk in self.query_agent("synthesizer", [{"role": "user", "content": debate}]):
            synthesizer_response += chunk
            yield {"type": "chunk", "agent": "synthesizer", "content": chunk}

        yield {"type": "agent_done", "agent": "synthesizer", "full_response": synthesizer_response}
        yield {"type": "session_complete", "all_responses": agent_responses, "final": synthesizer_response}

    async def single_agent_query(
        self,
        agent_name: str,
        message: str,
        history: List[Dict] = None
    ) -> AsyncGenerator[str, None]:
        """Query satu agent spesifik"""
        messages = [*(history or []), {"role": "user", "content": message}]
        async for chunk in self.query_agent(agent_name, messages):
            yield chunk

    async def check_ollama_health(self) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{self.ollama_url}/api/tags")
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "status": "online",
                        "models": [m["name"] for m in data.get("models", [])],
                        "url": self.ollama_url
                    }
        except Exception as e:
            return {"status": "offline", "error": str(e), "url": self.ollama_url}
        return {"status": "offline", "url": self.ollama_url}


agent_engine = MultiAgentEngine()
