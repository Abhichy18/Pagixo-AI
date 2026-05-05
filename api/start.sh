#!/bin/bash
# ─── Pagixo OCR API — Quick Start Script ───
# Starts the FastAPI server on port 8000 with hot-reload.
# Run from the PROJECT ROOT (not from api/):
#   chmod +x api/start.sh && ./api/start.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Starting Pagixo OCR API..."
echo "   Project root: $PROJECT_ROOT"
echo "   API URL: http://localhost:8000"
echo "   Docs: http://localhost:8000/docs"
echo ""

cd "$PROJECT_ROOT"

uvicorn api.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --reload-dir api/
