#!/bin/bash
# ═══════════════════════════════════════════════════
# FIX N8N - Jalankan dari folder ai-ecosystem
# Usage: bash fix-n8n.sh
# ═══════════════════════════════════════════════════

if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Jalankan dari folder ai-ecosystem!"
    exit 1
fi

echo "▶ Step 1: Cek status semua container..."
sudo docker compose ps
echo ""

echo "▶ Step 2: Cek log n8n untuk tahu penyebab crash..."
sudo docker logs ai-n8n --tail 20
echo ""

echo "▶ Step 3: Buat database 'n8n' di postgres jika belum ada..."
sudo docker exec ai-postgres psql -U postgres -c "CREATE DATABASE n8n;" 2>/dev/null && \
    echo "✅ Database n8n dibuat" || \
    echo "ℹ️  Database n8n sudah ada (normal)"

echo ""
echo "▶ Step 4: Ganti N8N dari postgres ke SQLite (lebih stabil, tidak perlu postgres)..."

# Backup docker-compose dulu
cp docker-compose.yml docker-compose.yml.bak
echo "✅ Backup: docker-compose.yml.bak"

# Tulis ulang bagian n8n di docker-compose - pakai SQLite bukan postgres
python3 - << 'PYEOF'
import re

with open('docker-compose.yml', 'r') as f:
    content = f.read()

# Ganti konfigurasi n8n - hapus DB postgres, pakai SQLite
old_n8n_env = """    environment:
      - N8N_HOST=0.0.0.0
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - WEBHOOK_URL=http://n8n:5678/
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_USER:-admin}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD:-admin123}
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=postgres
      - DB_POSTGRESDB_PASSWORD=${POSTGRES_PASSWORD:-postgres123}
    depends_on:
      - postgres"""

new_n8n_env = """    environment:
      - N8N_HOST=0.0.0.0
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - WEBHOOK_URL=http://localhost:5678/
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_USER:-admin}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD:-admin123}
      - DB_TYPE=sqlite
      - N8N_RUNNERS_ENABLED=true
    depends_on:
      - postgres"""

if old_n8n_env in content:
    content = content.replace(old_n8n_env, new_n8n_env)
    print("✅ Konfigurasi n8n diubah ke SQLite")
else:
    # Coba cara lain - replace baris DB_TYPE
    content = re.sub(r'- DB_TYPE=postgresdb\n.*?- DB_POSTGRESDB_HOST=postgres\n.*?- DB_POSTGRESDB_PORT=5432\n.*?- DB_POSTGRESDB_DATABASE=n8n\n.*?- DB_POSTGRESDB_USER=postgres\n.*?- DB_POSTGRESDB_PASSWORD=.*?\n', 
                     '- DB_TYPE=sqlite\n      - N8N_RUNNERS_ENABLED=true\n', 
                     content, flags=re.DOTALL)
    print("✅ Konfigurasi n8n diupdate (regex mode)")

with open('docker-compose.yml', 'w') as f:
    f.write(content)
PYEOF

echo ""
echo "▶ Step 5: Restart n8n..."
sudo docker compose stop n8n
sudo docker compose rm -f n8n
sudo docker compose up -d n8n

echo ""
echo "▶ Menunggu n8n siap (20 detik)..."
sleep 20

echo ""
echo "▶ Step 6: Cek status n8n..."
sudo docker logs ai-n8n --tail 15

echo ""
echo "▶ Step 7: Test akses n8n..."
if curl -sf http://localhost:5678 > /dev/null 2>&1; then
    echo "✅ N8N bisa diakses di http://localhost:5678"
else
    echo "⏳ N8N masih loading, tunggu 10-30 detik lalu buka http://localhost:5678"
fi

echo ""
echo "══════════════════════════════════════════════"
echo "✅ Script selesai!"
echo ""
echo "Buka browser: http://localhost:5678"
echo "Login: admin / admin123"
echo "══════════════════════════════════════════════"
