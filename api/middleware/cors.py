"""
CORS middleware configuration for the Pagixo OCR API.
Handles cross-origin requests from the Chrome Extension and localhost dev servers.

Security:
  - Development: permissive (all origins allowed)
  - Production:  explicit allowlist only + CORS rejection logging
"""

import os
import logging
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("pagixo.cors")


def get_allowed_origins() -> list[str]:
    """
    Build the list of allowed origins based on environment.
    
    In development (default): allows all origins for easy testing.
    In production (PRODUCTION=true): restricts to explicit origins only.
    """
    env_origins = os.getenv("ALLOWED_ORIGINS", "")
    is_production = os.getenv("PRODUCTION", "false").lower() == "true"

    if is_production and env_origins:
        # Production: only explicitly listed origins
        origins = [o.strip() for o in env_origins.split(",") if o.strip()]
        logger.info(f"[Pagixo] CORS production mode — allowed origins: {origins}")
        return origins

    # Development: permissive defaults
    default_origins = [
        "http://localhost:3000",
        "http://localhost:5173",    # Vite dev server
        "http://localhost:8000",
        "http://localhost:8501",    # Streamlit
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
        "http://127.0.0.1:8501",
    ]

    # Merge with any user-specified origins from .env
    if env_origins:
        extra = [o.strip() for o in env_origins.split(",") if o.strip()]
        default_origins.extend(extra)

    # Deduplicate
    origins = list(dict.fromkeys(default_origins))
    logger.info(f"[Pagixo] CORS dev mode — allowed origins: {origins}")
    return origins


class CORSRejectionLogger(BaseHTTPMiddleware):
    """
    Middleware that logs CORS rejections in production mode.
    Runs before the CORSMiddleware so it can inspect the raw origin.
    """

    def __init__(self, app, allowed_origins: list[str], is_production: bool):
        super().__init__(app)
        self.allowed_origins = set(allowed_origins)
        self.is_production = is_production

    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin", "")

        if self.is_production and origin:
            # Check if origin is in allowlist or matches chrome-extension pattern
            is_allowed = (
                origin in self.allowed_origins
                or origin.startswith("chrome-extension://")
            )

            if not is_allowed:
                logger.warning(
                    f"[Pagixo] CORS REJECTED — origin='{origin}' "
                    f"path='{request.url.path}' method='{request.method}'"
                )

        response = await call_next(request)
        return response


def setup_cors(app: FastAPI) -> None:
    """
    Mount CORS middleware onto the FastAPI app.
    
    Chrome extensions use chrome-extension:// origins which require
    allow_origin_regex to match dynamically since the extension ID
    varies per installation.
    """
    allowed_origins = get_allowed_origins()
    is_production = os.getenv("PRODUCTION", "false").lower() == "true"

    # Add CORS rejection logger (runs first, before CORSMiddleware)
    app.add_middleware(CORSRejectionLogger, allowed_origins=allowed_origins, is_production=is_production)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins if is_production else ["*"],
        allow_origin_regex=r"^chrome-extension://.*$",  # Always allow Chrome extensions
        allow_credentials=True,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-Processing-Time-Ms", "X-Client-Version"],
    )

    mode = "production" if is_production else "dev"
    logger.info(f"[Pagixo] CORS middleware mounted ({mode} mode)")
