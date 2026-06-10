# ⬡ AI ECOSYSTEM — Quick Start

> Sistem AI Multi-Agent lokal: Ollama + N8N + FastAPI + Dashboard + Chatbot

## 🚀 Mulai Cepat (3 Langkah)

### 1. Jalankan Instalasi
```bash
# Mac/Linux
chmod +x scripts/install.sh && ./scripts/install.sh

# Windows — klik dua kali:
scripts/install-windows.bat
```

### 2. Buka Aplikasi
| Aplikasi | URL |
|---|---|
| 🖥️ **Dashboard Admin** | http://localhost:3000 |
| 💬 **Chatbot AI** | http://localhost:3001 |
| ⚡ **N8N Automation** | http://localhost:5678 |
| 📚 **API Docs** | http://localhost:8000/api/docs |

### 3. Mulai Chat
Buka http://localhost:3001 dan mulai bertanya!

---

## 📁 Struktur Proyek

```
ai-ecosystem/
├── docker-compose.yml          # Orkestrator semua layanan
├── .env.example                # Template konfigurasi
├── backend/                    # FastAPI + Multi-Agent Engine
│   ├── main.py                 # Entry point API
│   ├── agents/multi_agent.py   # Sistem 3 agent
│   ├── api/routes/             # Endpoint API
│   └── services/               # Database, WebSocket, Supabase
├── frontend-dashboard/         # Admin Dashboard (HTML/JS)
├── frontend-chatbot/           # Chatbot Interface (HTML/JS)
├── docker/                     # Konfigurasi Docker
├── n8n-workflows/              # Template workflow N8N
├── scripts/                    # Script instalasi
└── docs/PANDUAN-LENGKAP.md     # Panduan lengkap
```

## 🤖 Arsitektur Multi-Agent

```
User Input
    ↓
┌──────────────────────────────────────┐
│           AGENT ANALYST              │
│  Menganalisis masalah secara         │
│  mendalam dan sistematis             │
└──────────────┬───────────────────────┘
               ↓
┌──────────────────────────────────────┐
│           AGENT CRITIC               │
│  Mengkritisi analisis, mencari       │
│  kelemahan & alternatif              │
└──────────────┬───────────────────────┘
               ↓
┌──────────────────────────────────────┐
│         AGENT SYNTHESIZER            │
│  Menyatukan semua perspektif         │
│  → Solusi final + Action Items       │
└──────────────────────────────────────┘
```

## ⚙️ Perintah Berguna

```bash
docker compose start          # Jalankan setelah shutdown
docker compose stop           # Hentikan semua
docker compose ps             # Status container
docker compose logs -f        # Lihat log live
docker compose restart backend # Restart satu layanan

# Pull model AI baru
docker exec ai-ollama ollama pull qwen2.5:7b
docker exec ai-ollama ollama list
```

## 📋 Konfigurasi .env Penting

```env
POSTGRES_PASSWORD=ganti_ini        # Password database
N8N_PASSWORD=ganti_ini             # Password N8N
SECRET_KEY=random_64_char_string   # JWT secret key
SUPABASE_URL=https://xxx.supabase.co   # (Opsional)
SUPABASE_KEY=eyJ...                    # (Opsional)
OLLAMA_MODEL_ANALYST=llama3.1:8b   # Model untuk setiap agent
```

## 📖 Dokumentasi Lengkap

Baca file: `docs/PANDUAN-LENGKAP.md`

---
*Powered by Ollama • FastAPI • N8N • PostgreSQL • Redis*
