@echo off
REM ============================================================================
REM  Thunity - Windows start (OPTIONAL / WINDOWS ONLY)
REM ----------------------------------------------------------------------------
REM  This is a convenience launcher for Windows + Docker Desktop. It is NOT the
REM  primary supported path. Acung uses macOS (start_thunity_mac.command) and
REM  Joshua uses Linux/ROCm (start_thunity_linux_rocm.sh).
REM
REM  On Windows, Ollama runs on the HOST (install Ollama for Windows and run it),
REM  so this script does NOT start container Ollama (same approach as the Mac).
REM
REM  SAFE: never runs "docker compose down -v", never deletes volumes or models.
REM ============================================================================
setlocal
cd /d "%~dp0\.."

echo == Thunity - Windows start ==
echo repo: %cd%
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo [STOP] Docker not found. Install Docker Desktop, then re-run.
  goto :end
)
docker info >nul 2>&1
if errorlevel 1 (
  echo [STOP] Docker is not running. Start Docker Desktop, then re-run.
  goto :end
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo [WARN] .env was missing - created from .env.example.
  echo Set POSTGRES_PASSWORD, N8N_BASIC_AUTH_PASSWORD, SECRET_KEY, FOUNDER_PASSWORD, then re-run.
  goto :end
)

REM Backend container -> host Ollama on Windows
set OLLAMA_URL=http://host.docker.internal:11434

echo Starting Docker services: postgres, redis, n8n, backend ...
docker compose up -d postgres redis n8n backend
if errorlevel 1 (
  echo [STOP] docker compose failed. See messages above.
  goto :end
)

echo.
echo Open in your browser:
echo   Frontend (UI):    http://localhost:3000   (start it below)
echo   Backend health:   http://localhost:8000/api/health/local-only
echo   API docs:         http://localhost:8000/api/docs
echo   n8n:              http://localhost:5678
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo [WARN] Node/npm not found. Backend may be up, but the UI cannot start.
  echo Install Node 18+ from https://nodejs.org , then run: cd frontend ^&^& npm install ^&^& npm run dev
  goto :end
)

if not exist "frontend\node_modules" (
  echo Installing frontend dependencies (first run)...
  pushd frontend
  call npm install
  popd
)

echo Starting frontend dev server on http://localhost:3000 (Ctrl+C to stop)...
pushd frontend
call npm run dev
popd

:end
echo.
echo Done. Docker services may still be running. Stop them with: docker compose stop
endlocal
