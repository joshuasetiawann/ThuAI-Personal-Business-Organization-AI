.PHONY: help start stop restart logs build clean pull-model status

help:
	@echo "╔══════════════════════════════════════════════╗"
	@echo "║          AI ECOSYSTEM - Makefile             ║"
	@echo "╚══════════════════════════════════════════════╝"
	@echo ""
	@echo "  make start        - Jalankan semua layanan"
	@echo "  make stop         - Hentikan semua layanan"
	@echo "  make restart      - Restart semua layanan"
	@echo "  make build        - Build ulang container"
	@echo "  make logs         - Lihat log real-time"
	@echo "  make status       - Cek status container"
	@echo "  make pull-model   - Download model Ollama"
	@echo "  make clean        - Hapus container (data aman)"
	@echo "  make open         - Buka browser"
	@echo ""

start:
	docker compose up -d
	@echo "✅ Sistem berjalan. Buka: http://localhost:3000"

stop:
	docker compose stop
	@echo "✅ Sistem dihentikan"

restart:
	docker compose restart
	@echo "✅ Sistem di-restart"

build:
	docker compose up -d --build
	@echo "✅ Build selesai"

logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

status:
	docker compose ps

pull-model:
	@read -p "Nama model (contoh: llama3.1:8b): " model; \
	docker exec ai-ollama ollama pull $$model

list-models:
	docker exec ai-ollama ollama list

clean:
	docker compose down
	@echo "✅ Container dihapus (data volume tetap aman)"

open:
	@command -v xdg-open &>/dev/null && xdg-open http://localhost:3000 || \
	command -v open &>/dev/null && open http://localhost:3000 || \
	echo "Buka manual: http://localhost:3000"

dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
	@echo "✅ Mode development aktif"
