"""
Pagixo OCR API — FastAPI Bridge for the Chrome Extension.

This is the main entrypoint for the FastAPI server that bridges
the Chrome Extension to the existing OCR pipeline.

Runs on port 8000 (Streamlit stays on 8501 — completely untouched).

Usage:
    uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
"""

import sys
import os
import time
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse

# ─── Path Setup ───────────────────────────────────────────────────────────────
# Add project root to sys.path so we can import enhance_image.py and 
# other root-level modules without modifying them.
PROJECT_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
sys.path.insert(0, PROJECT_ROOT)

# Load .env from project root
from dotenv import load_dotenv
load_dotenv(os.path.join(PROJECT_ROOT, ".env"), override=True)

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("pagixo.api")

# ─── App State ────────────────────────────────────────────────────────────────
_startup_time: float = 0.0


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup/shutdown events.
    
    Startup:
      - Log service info
      - Record startup time for uptime tracking
      - Verify API keys are available
    
    Shutdown:
      - Clean up resources
    """
    global _startup_time
    _startup_time = time.time()

    # Verify critical environment variables
    nvidia_key = os.getenv("NVIDIA_API_KEY")
    openrouter_key = os.getenv("OPENROUTER_API_KEY")

    logger.info("=" * 60)
    logger.info("🚀 Pagixo OCR API starting up...")
    logger.info(f"   Project root: {PROJECT_ROOT}")
    logger.info(f"   NVIDIA API Key: {'✅ Found' if nvidia_key else '❌ Missing'}")
    logger.info(f"   OpenRouter API Key: {'✅ Found' if openrouter_key else '❌ Missing'}")
    logger.info(f"   Port: {os.getenv('API_PORT', '8000')}")
    logger.info("=" * 60)

    if not nvidia_key and not openrouter_key:
        logger.warning(
            "⚠️  No API keys found! At least one of NVIDIA_API_KEY or "
            "OPENROUTER_API_KEY must be set in .env for OCR to work."
        )

    yield  # App runs here

    # Shutdown
    logger.info("🛑 Pagixo OCR API shutting down...")


# ─── FastAPI App ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="Pagixo OCR API",
    description=(
        "FastAPI bridge for the Pagixo OCR Chrome Extension. "
        "Provides REST endpoints for image/PDF OCR processing "
        "using NVIDIA Nemotron and OpenRouter models."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Mount CORS middleware
from api.middleware.cors import setup_cors
setup_cors(app)

# Include OCR and Chat routers
from api.routers.ocr import router as ocr_router
from api.routers.chat import router as chat_router
app.include_router(ocr_router)
app.include_router(chat_router)


# ─── Health Endpoint ──────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health_check():
    """
    Health check endpoint.
    Returns service status, version, and uptime.
    Used by the Chrome Extension to verify API availability.
    """
    uptime = round(time.time() - _startup_time, 2) if _startup_time else 0.0
    return JSONResponse(
        content={
            "status": "ok",
            "service": "pagixo-ocr-api",
            "version": "1.0.0",
            "uptime_seconds": uptime,
        }
    )


@app.get("/", tags=["System"])
async def root():
    """Root endpoint — redirects to docs."""
    return {
        "message": "Pagixo OCR API is running",
        "docs": "/docs",
        "health": "/health",
    }


# ─── Run directly (optional) ─────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("API_PORT", "8000"))
    host = os.getenv("API_HOST", "0.0.0.0")

    uvicorn.run(
        "api.main:app",
        host=host,
        port=port,
        reload=True,
        log_level="info",
    )
