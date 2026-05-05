#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Pagixo OCR — Start Both Services (Local Dev, No Docker)
# ─────────────────────────────────────────────────────────────
# Usage: ./start-dev.sh
# Starts Streamlit (8501) + FastAPI (8000) in parallel.
# Press Ctrl+C to stop both cleanly.
# ─────────────────────────────────────────────────────────────

set -e

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║       🚀 Pagixo OCR Dev Server          ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${NC}"

# Get the script directory (project root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠  No .env file found. Copy .env.example and add your API keys.${NC}"
fi

# ─── Trap Ctrl+C → kill both processes cleanly ─────
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down...${NC}"
    
    if [ -n "$STREAMLIT_PID" ] && kill -0 "$STREAMLIT_PID" 2>/dev/null; then
        kill "$STREAMLIT_PID" 2>/dev/null
        echo "  ✓ Streamlit stopped"
    fi
    
    if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
        kill "$API_PID" 2>/dev/null
        echo "  ✓ FastAPI stopped"
    fi
    
    echo -e "${GREEN}👋 All services stopped.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# ─── Start Streamlit ───────────────────────────────
echo -e "${GREEN}▸ Starting Streamlit...${NC}"
streamlit run app.py --server.port 8501 --server.headless true &
STREAMLIT_PID=$!

# Brief pause to let Streamlit initialize
sleep 2

# ─── Start FastAPI ─────────────────────────────────
echo -e "${GREEN}▸ Starting FastAPI Bridge...${NC}"
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir api/ &
API_PID=$!

sleep 1

echo ""
echo -e "${CYAN}  ┌─────────────────────────────────────────┐${NC}"
echo -e "${CYAN}  │  Streamlit:  ${GREEN}http://localhost:8501${CYAN}       │${NC}"
echo -e "${CYAN}  │  API:        ${GREEN}http://localhost:8000${CYAN}       │${NC}"
echo -e "${CYAN}  │  API Docs:   ${GREEN}http://localhost:8000/docs${CYAN}  │${NC}"
echo -e "${CYAN}  └─────────────────────────────────────────┘${NC}"
echo ""
echo -e "${YELLOW}  Press Ctrl+C to stop both services${NC}"
echo ""

# Wait for either process to exit
wait
