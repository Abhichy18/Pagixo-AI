@echo off
REM ─────────────────────────────────────────────────────────────
REM  Pagixo OCR — Start Both Services (Windows Dev, No Docker)
REM ─────────────────────────────────────────────────────────────
REM  Usage: start-dev.bat
REM  Starts Streamlit (8501) + FastAPI (8000) in parallel.
REM  Close either terminal window to stop that service.
REM ─────────────────────────────────────────────────────────────

echo.
echo   ╔══════════════════════════════════════════╗
echo   ║       Pagixo OCR Dev Server              ║
echo   ╚══════════════════════════════════════════╝
echo.

REM Check .env exists
if not exist ".env" (
    echo   [WARNING] No .env file found. Copy .env.example and add your API keys.
    echo.
)

echo   Starting Streamlit on port 8501...
start "Pagixo Streamlit" cmd /k "cd /d %~dp0 && streamlit run app.py --server.port 8501 --server.headless true"

REM Brief pause
timeout /t 2 /nobreak >nul

echo   Starting FastAPI on port 8000...
start "Pagixo API" cmd /k "cd /d %~dp0 && uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir api/"

echo.
echo   ┌─────────────────────────────────────────┐
echo   │  Streamlit:  http://localhost:8501       │
echo   │  API:        http://localhost:8000       │
echo   │  API Docs:   http://localhost:8000/docs  │
echo   └─────────────────────────────────────────┘
echo.
echo   Close the terminal windows to stop services.
echo.
