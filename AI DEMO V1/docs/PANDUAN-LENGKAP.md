# 📖 PANDUAN LENGKAP AI ECOSYSTEM
### Untuk Pengguna Non-Teknis — Dibaca dari Atas ke Bawah

---

## 🎯 APA YANG SUDAH ANDA DAPATKAN?

Sistem ini terdiri dari **5 komponen utama** yang bekerja bersama:

| Komponen | Fungsi | Alamat |
|---|---|---|
| **Dashboard Admin** | Pantau semua sistem | http://localhost:3000 |
| **Chatbot AI** | Chat dengan 3 AI Agent | http://localhost:3001 |
| **Ollama** | Menjalankan AI di komputer Anda | http://localhost:11434 |
| **N8N** | Otomatisasi tugas & workflow | http://localhost:5678 |
| **PostgreSQL** | Database penyimpanan data | localhost:5432 |

---

## ✅ LANGKAH 1 — PERSIAPAN (Lakukan Sekali Saja)

### A. Install Docker Desktop

Docker adalah "wadah" yang menjalankan semua sistem ini tanpa mengacaukan komputer Anda.

**Windows:**
1. Buka browser, pergi ke: https://www.docker.com/products/docker-desktop/
2. Klik "Download for Windows"
3. Jalankan file installer yang diunduh
4. Ikuti petunjuk instalasi (klik Next → Next → Finish)
5. Restart komputer setelah selesai
6. Buka Docker Desktop, tunggu hingga ikon Docker di taskbar berhenti berputar

**Mac:**
1. Buka browser, pergi ke: https://www.docker.com/products/docker-desktop/
2. Pilih "Download for Mac" (sesuaikan: Apple Chip atau Intel)
3. Drag icon Docker ke folder Applications
4. Buka Docker dari Applications
5. Izinkan semua permission yang diminta

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Logout lalu login kembali
```

### B. Cek Docker Sudah Terinstall

Buka **Terminal** (Mac/Linux) atau **Command Prompt** (Windows), ketik:
```
docker --version
```
Harus muncul sesuatu seperti: `Docker version 24.0.x`

---

## ✅ LANGKAH 2 — EKSTRAK DAN MASUK KE FOLDER

1. Ekstrak file ZIP yang Anda terima
2. Buka Terminal/Command Prompt
3. Masuk ke folder hasil ekstrak:

**Windows:**
```
cd C:\Users\NamaAnda\Downloads\ai-ecosystem
```

**Mac/Linux:**
```
cd ~/Downloads/ai-ecosystem
```

---

## ✅ LANGKAH 3 — KONFIGURASI (Opsional tapi Penting)

Buka file `.env` dengan Notepad (Windows) atau TextEdit (Mac).

**File ini berisi pengaturan sistem. Yang WAJIB diubah:**

```
POSTGRES_PASSWORD=ganti_dengan_password_kuat_anda
N8N_PASSWORD=ganti_dengan_password_n8n_anda
```

**Yang OPSIONAL (untuk sinkronisasi cloud Supabase):**
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJhbGci...
```
> Jika tidak punya Supabase, biarkan saja. Sistem tetap berjalan 100% secara lokal.

Simpan file setelah selesai mengedit.

---

## ✅ LANGKAH 4 — INSTALASI OTOMATIS

### Windows:
Klik dua kali pada file: `scripts/install-windows.bat`

### Mac/Linux:
Buka Terminal di folder ai-ecosystem, ketik:
```bash
chmod +x scripts/install.sh
./scripts/install.sh
```

**Apa yang terjadi selama instalasi:**
- ⏳ Docker mengunduh semua komponen (3-10 menit tergantung internet)
- ⏳ Script membuat konfigurasi otomatis
- ⏳ Anda diminta memilih model AI untuk diunduh

**PERHATIAN:** Pengunduhan model AI membutuhkan **4-10GB** dan bisa memakan waktu **10-30 menit** tergantung kecepatan internet. Biarkan berjalan.

---

## ✅ LANGKAH 5 — PILIH MODEL AI

Saat instalasi, Anda akan diminta memilih model:

```
1) llama3.1:8b  ← PILIH INI jika tidak yakin (4.7GB)
2) llama3.2:3b  ← Pilih ini jika RAM komputer < 8GB (2GB)  
3) mistral:7b   ← Alternatif bagus untuk coding (4.1GB)
4) qwen2.5:7b   ← Terbaik untuk Bahasa Indonesia (4.4GB)
```

**Rekomendasi berdasarkan spesifikasi komputer:**
- RAM 8GB  → Pilih opsi 2 (llama3.2:3b)
- RAM 16GB → Pilih opsi 1 (llama3.1:8b)  
- RAM 32GB → Bisa pilih opsi 4 (qwen2.5:7b)

---

## ✅ LANGKAH 6 — BUKA APLIKASI

Setelah instalasi selesai, buka browser dan akses:

### 🖥️ Dashboard Admin
**http://localhost:3000**

Di sini Anda bisa:
- Melihat status semua layanan (online/offline)
- Memantau penggunaan CPU, Memory, Disk
- Melihat log komunikasi antar-agent
- Mengelola file yang bisa diakses AI
- Memantau sinkronisasi database

### 💬 Chatbot AI
**http://localhost:3001**

Di sini Anda bisa:
- Chat dengan 3 AI Agent sekaligus (mode Kolaboratif)
- Upload file untuk dianalisis AI
- Kirim gambar untuk dianalisis
- Gunakan suara untuk bertanya (klik tombol 🎤)
- Aktifkan Text-to-Speech (klik 🔊)
- Bagikan layar untuk debugging (klik 🖥️)

---

## 🤖 CARA MENGGUNAKAN CHATBOT

### Mode Kolaboratif (Default — Paling Canggih)
Tiga agent berdiskusi untuk memberi jawaban terbaik:
1. **ANALYST** menganalisis masalah Anda secara mendalam
2. **CRITIC** mencari kelemahan dan alternatif
3. **SYNTHESIZER** menyatukan semua jadi solusi actionable

**Contoh pertanyaan yang bagus:**
- *"Bagaimana strategi terbaik untuk meluncurkan produk baru di pasar yang sudah jenuh?"*
- *"Analisis kode Python ini dan temukan bug-nya: [paste kode]"*
- *"Buat rencana bisnis 6 bulan untuk startup e-commerce dengan modal 50 juta"*
- *"Review kontrak kerja ini dan identifikasi klausul yang merugikan: [paste teks]"*

### Mode Agent Tunggal
Pilih dari header chatbot:
- **🔍 Analyst** — Untuk analisis mendalam saja
- **⚔️ Critic** — Untuk evaluasi kritis saja  
- **✨ Synthesizer** — Untuk kesimpulan dan action plan saja

### Upload File
1. Klik tombol **📎 File** di bawah chat
2. Pilih file (PDF, Word, Excel, TXT, Python, dll)
3. AI akan membaca isinya dan siap menjawab pertanyaan tentang file tersebut

### Voice Input (Suara)
1. Klik tombol **🎤 Suara**
2. Izinkan akses mikrofon saat browser meminta
3. Bicara pertanyaan Anda
4. Klik Stop ketika selesai
5. Teks akan otomatis muncul di kotak chat

### Screen Share
1. Klik tombol **🖥️ Screen Share**
2. Pilih layar atau window yang ingin dibagikan
3. Ketik pertanyaan tentang apa yang ada di layar
4. AI akan melihat dan membantu menganalisis

---

## ⚙️ MENGGUNAKAN N8N (Otomatisasi)

N8N memungkinkan Anda membuat "resep" otomatisasi tanpa coding.

**Cara akses:** http://localhost:5678
**Login:** admin / admin123 (ganti sesuai .env Anda)

### Import Workflow Siap Pakai

1. Buka N8N di browser
2. Klik **"Add workflow"** → **"Import from file"**
3. Upload file dari folder `n8n-workflows/`:
   - `auto-document-generator.json` — AI membuat dokumen otomatis
   - `laporan-harian.json` — Laporan sistem otomatis setiap hari

### Contoh yang Bisa Dilakukan N8N + AI:
- Setiap ada email masuk → AI merangkum dan simpan ke file
- Setiap jam 8 pagi → AI buat laporan harian dan kirim ke Slack
- Saat ada file baru di folder → AI analisis dan buat ringkasan
- Setiap minggu → AI buat laporan performa bisnis

---

## 🗄️ SINKRONISASI SUPABASE (Opsional)

Supabase adalah database cloud gratis. Berguna sebagai backup dan akses dari mana saja.

### Cara Setup Supabase Gratis:
1. Buka https://supabase.com
2. Klik "Start your project" → Daftar gratis
3. Buat project baru (pilih region terdekat: Singapore)
4. Setelah project dibuat, pergi ke **Settings → API**
5. Copy **Project URL** dan **anon public key**
6. Paste ke file `.env`:
   ```
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_KEY=eyJhbGci...
   ```
7. Restart sistem: `docker compose restart backend`

---

## 🔧 PERINTAH BERGUNA

Buka Terminal/Command Prompt di folder ai-ecosystem:

```bash
# Jalankan sistem (setelah restart komputer)
docker compose start

# Hentikan sistem
docker compose stop

# Lihat status semua container
docker compose ps

# Lihat log real-time
docker compose logs -f

# Lihat log satu layanan saja
docker compose logs -f backend
docker compose logs -f ollama

# Restart satu layanan
docker compose restart backend

# Update ke versi terbaru
docker compose pull
docker compose up -d

# Hapus semua dan mulai ulang (DATA TIDAK HILANG)
docker compose down
docker compose up -d --build
```

---

## ❌ TROUBLESHOOTING — MASALAH UMUM

### "Docker tidak ditemukan"
→ Install Docker Desktop terlebih dahulu (Langkah 1)

### "Port sudah digunakan"
→ Kemungkinan ada aplikasi lain di port yang sama. Coba:
```bash
docker compose down
docker compose up -d
```

### "AI tidak merespons / timeout"
→ Model sedang dimuat ke memori. Tunggu 1-2 menit setelah pertama kali.
→ Cek RAM tersedia, minimal 4GB bebas.

### "Tidak bisa akses localhost:3000"
→ Tunggu 1-2 menit setelah `docker compose up`
→ Cek status: `docker compose ps`
→ Semua harus status "Up"

### "Model AI tidak ada"
→ Unduh model: `docker exec ai-ollama ollama pull llama3.1:8b`

### "Backend offline di Dashboard"
→ Lihat log: `docker compose logs backend`
→ Restart: `docker compose restart backend`

### AI menjawab dalam bahasa Inggris
→ Tambahkan di awal pesan: "Jawab dalam Bahasa Indonesia:"
→ Atau gunakan model qwen2.5:7b yang lebih baik dalam Bahasa Indonesia

---

## 📊 SPESIFIKASI MINIMUM SISTEM

| Komponen | Minimum | Rekomendasi |
|---|---|---|
| RAM | 8 GB | 16 GB |
| Storage | 20 GB bebas | 50 GB bebas |
| CPU | 4 core | 8 core |
| GPU | Tidak wajib | NVIDIA (lebih cepat) |
| Internet | Untuk download awal | Tidak perlu setelahnya |
| OS | Windows 10/Mac/Linux | Windows 11/Mac M1+ |

---

## 🔒 KEAMANAN & PRIVASI

✅ **Semua data 100% di komputer Anda** — tidak ada yang dikirim ke cloud tanpa izin Anda  
✅ **Model AI berjalan lokal** — tidak perlu internet setelah setup  
✅ **Sinkronisasi Supabase opsional** — hanya aktif jika Anda mengkonfigurasinya  
✅ **File hanya bisa diakses dari direktori yang diizinkan** (`/data/files`)

**Untuk keamanan tambahan:**
- Ganti semua password default di file `.env`
- Jangan expose port ke internet tanpa VPN/firewall
- Backup folder `data/` secara berkala

---

## 📞 JIKA BUTUH BANTUAN

1. Lihat log error: `docker compose logs -f`
2. Screenshot error dan bagikan ke tim teknis
3. Sertakan output dari: `docker compose ps`

---

*Dibuat untuk: AI Ecosystem v1.0 | Powered by Ollama + FastAPI + N8N*
