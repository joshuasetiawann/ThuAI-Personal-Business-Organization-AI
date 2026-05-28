#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  AI ECOSYSTEM - Script Instalasi Otomatis
#  Jalankan: chmod +x install.sh && ./install.sh
# ═══════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

print_banner() {
  echo -e "${CYAN}"
  echo "╔══════════════════════════════════════════════╗"
  echo "║        AI ECOSYSTEM - Auto Installer         ║"
  echo "║   Ollama + N8N + Supabase + Multi-Agent      ║"
  echo "╚══════════════════════════════════════════════╝"
  echo -e "${NC}"
}

print_step() { echo -e "\n${BLUE}▶ $1${NC}"; }
print_ok()   { echo -e "${GREEN}✅ $1${NC}"; }
print_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_err()  { echo -e "${RED}❌ $1${NC}"; }

# ──────────────────────────────────────────
# CEK DOCKER
# ──────────────────────────────────────────
check_docker() {
  print_step "Memeriksa Docker..."
  if ! command -v docker &>/dev/null; then
    print_err "Docker tidak ditemukan!"
    echo "Install Docker dari: https://docs.docker.com/get-docker/"
    exit 1
  fi
  if ! command -v docker-compose &>/dev/null; then
    print_err "Docker Compose tidak ditemukan!"
    exit 1
  fi
  print_ok "Docker $(docker --version | cut -d' ' -f3) siap"
}

# ──────────────────────────────────────────
# BUAT FILE .env
# ──────────────────────────────────────────
setup_env() {
  print_step "Menyiapkan file konfigurasi .env..."
  if [ ! -f .env ]; then
    cp .env.example .env
    # Generate random secret key
    SECRET=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
    sed -i.bak "s/ganti_dengan_random_string_sangat_panjang_minimal_32_karakter/$SECRET/" .env
    rm -f .env.bak
    print_ok "File .env dibuat dengan secret key acak"
  else
    print_warn ".env sudah ada, dilewati"
  fi
}

# ──────────────────────────────────────────
# BUAT DIREKTORI DATA
# ──────────────────────────────────────────
setup_dirs() {
  print_step "Membuat direktori data..."
  mkdir -p data/files/documents data/files/uploads data/files/reports
  echo "# Direktori untuk file yang bisa diakses AI Agent" > data/files/README.md
  print_ok "Direktori /data/files siap"
}

# ──────────────────────────────────────────
# JALANKAN DOCKER COMPOSE
# ──────────────────────────────────────────
start_services() {
  print_step "Menjalankan semua layanan Docker..."
  echo "Ini mungkin memakan waktu 3-5 menit pertama kali (download image)..."
  docker-compose up -d --build
  print_ok "Semua container berhasil dijalankan"
}

# ──────────────────────────────────────────
# TUNGGU LAYANAN SIAP
# ──────────────────────────────────────────
wait_for_services() {
  print_step "Menunggu layanan siap..."
  local max_wait=120
  local waited=0

  echo -n "Menunggu Backend API"
  while ! curl -sf http://localhost:8000/api/health &>/dev/null; do
    echo -n "."
    sleep 3
    waited=$((waited+3))
    if [ $waited -ge $max_wait ]; then
      print_warn "Backend belum merespons (timeout). Cek dengan: docker-compose logs backend"
      break
    fi
  done
  echo ""
  print_ok "Backend API siap di http://localhost:8000"
}

# ──────────────────────────────────────────
# PULL MODEL OLLAMA
# ──────────────────────────────────────────
pull_ollama_model() {
  print_step "Mengunduh model AI (llama3.1:8b)..."
  print_warn "Proses ini membutuhkan ~4.7GB dan waktu tergantung kecepatan internet"
  echo ""
  echo "Pilihan model (ketik nomor):"
  echo "  1) llama3.1:8b   - Rekomendasi (4.7GB, seimbang antara kualitas & kecepatan)"
  echo "  2) llama3.2:3b   - Lebih cepat, lebih ringan (2GB, untuk RAM terbatas)"
  echo "  3) mistral:7b    - Alternatif bagus untuk coding (4.1GB)"
  echo "  4) qwen2.5:7b    - Bagus untuk Bahasa Indonesia (4.4GB)"
  echo "  5) Lewati (sudah punya model)"
  echo ""
  read -p "Pilihan [1]: " MODEL_CHOICE
  MODEL_CHOICE=${MODEL_CHOICE:-1}

  case $MODEL_CHOICE in
    1) MODEL="llama3.1:8b" ;;
    2) MODEL="llama3.2:3b" ;;
    3) MODEL="mistral:7b" ;;
    4) MODEL="qwen2.5:7b" ;;
    5) print_warn "Download model dilewati"; return ;;
    *) MODEL="llama3.1:8b" ;;
  esac

  echo "Mengunduh $MODEL..."
  docker exec ai-ollama ollama pull $MODEL

  # Update .env dengan model yang dipilih
  sed -i.bak "s/llama3.1:8b/$MODEL/g" .env 2>/dev/null || true
  rm -f .env.bak

  print_ok "Model $MODEL berhasil diunduh"
}

# ──────────────────────────────────────────
# TAMPILKAN RINGKASAN
# ──────────────────────────────────────────
print_summary() {
  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║          INSTALASI SELESAI! 🎉               ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  ${CYAN}🌐 Akses aplikasi di browser:${NC}"
  echo ""
  echo -e "  ${GREEN}Dashboard Admin  →${NC}  http://localhost:3000"
  echo -e "  ${GREEN}Chatbot AI       →${NC}  http://localhost:3001"
  echo -e "  ${GREEN}N8N Automation   →${NC}  http://localhost:5678"
  echo -e "  ${GREEN}API Docs         →${NC}  http://localhost:8000/api/docs"
  echo ""
  echo -e "  ${YELLOW}Login N8N: admin / admin123${NC}"
  echo -e "  ${YELLOW}(Ganti password di .env setelah login pertama)${NC}"
  echo ""
  echo -e "  ${CYAN}Perintah berguna:${NC}"
  echo -e "  docker-compose logs -f backend   # Lihat log backend"
  echo -e "  docker-compose stop              # Hentikan semua"
  echo -e "  docker-compose start             # Jalankan lagi"
  echo ""
}

# ──────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────
print_banner
check_docker
setup_env
setup_dirs
start_services
wait_for_services
pull_ollama_model
print_summary
