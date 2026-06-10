@echo off
chcp 65001 >nul
title AI Ecosystem - Installer Windows

echo.
echo ╔══════════════════════════════════════════════╗
echo ║        AI ECOSYSTEM - Auto Installer         ║
echo ║         untuk Windows (PowerShell)           ║
echo ╚══════════════════════════════════════════════╝
echo.

:: Cek Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker tidak ditemukan!
    echo Download Docker Desktop dari: https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)
echo [OK] Docker ditemukan

:: Buat .env jika belum ada
if not exist .env (
    copy .env.example .env
    echo [OK] File .env dibuat - EDIT file ini sebelum melanjutkan!
    notepad .env
    pause
) else (
    echo [OK] File .env sudah ada
)

:: Buat direktori data
if not exist "data\files\documents" mkdir "data\files\documents"
if not exist "data\files\uploads"   mkdir "data\files\uploads"
if not exist "data\files\reports"   mkdir "data\files\reports"
echo [OK] Direktori data siap

:: Jalankan Docker Compose
echo.
echo Menjalankan semua layanan (pertama kali bisa 5-10 menit)...
docker compose up -d --build
if errorlevel 1 (
    echo [ERROR] Gagal menjalankan Docker Compose
    pause
    exit /b 1
)
echo [OK] Semua container berjalan

:: Tunggu sebentar
echo Menunggu layanan siap (30 detik)...
timeout /t 30 /nobreak >nul

:: Pull model Ollama
echo.
echo Mengunduh model AI (llama3.1:8b ~4.7GB)...
echo Pilihan model:
echo   1) llama3.1:8b  - Rekomendasi
echo   2) llama3.2:3b  - Lebih ringan (RAM terbatas)
echo   3) Lewati
echo.
set /p MODEL_CHOICE="Pilihan [1]: "
if "%MODEL_CHOICE%"=="" set MODEL_CHOICE=1
if "%MODEL_CHOICE%"=="1" set MODEL=llama3.1:8b
if "%MODEL_CHOICE%"=="2" set MODEL=llama3.2:3b
if "%MODEL_CHOICE%"=="3" goto :skip_model

echo Mengunduh %MODEL%...
docker exec ai-ollama ollama pull %MODEL%
echo [OK] Model %MODEL% berhasil diunduh

:skip_model
echo.
echo ╔══════════════════════════════════════════════╗
echo ║          INSTALASI SELESAI!                  ║
echo ╚══════════════════════════════════════════════╝
echo.
echo   Dashboard Admin  : http://localhost:3000
echo   Chatbot AI       : http://localhost:3001
echo   N8N Automation   : http://localhost:5678
echo   API Docs         : http://localhost:8000/api/docs
echo.
echo   Login N8N        : admin / admin123
echo.

:: Buka browser otomatis
timeout /t 3 /nobreak >nul
start http://localhost:3000
start http://localhost:3001

pause
