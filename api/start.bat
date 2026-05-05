@echo off
REM ─── Pagixo OCR API — Quick Start Script (Windows) ───
REM Starts the FastAPI server on port 8000 with hot-reload.
REM Run from the PROJECT ROOT:
REM   api\start.bat

echo 🚀 Starting Pagixo OCR API...
echo    API URL: http://localhost:8000
echo    Docs: http://localhost:8000/docs
echo.

cd /d "%~dp0.."

uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir api/
