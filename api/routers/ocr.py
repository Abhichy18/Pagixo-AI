"""
OCR Router — Handles file upload, OCR processing, and history.

Security hardened:
  - File size validation (413 for > 20MB)
  - MIME type validation via magic bytes
  - Rate limiting: 30 requests/min per IP
  - X-Request-ID header on all responses
  - /api/origins endpoint for extension self-configuration

Endpoints:
  POST   /api/ocr      — Upload an image/PDF for OCR processing
  GET    /api/history   — Retrieve the last 50 scan results
  DELETE /api/history   — Clear all scan history
  GET    /api/origins   — List allowed CORS origins
"""

import os
import io
import uuid
import time
import logging
import tempfile
import threading
from collections import deque
from datetime import datetime
from typing import Optional

import fitz  # PyMuPDF
from PIL import Image
from fastapi import APIRouter, UploadFile, File, HTTPException, Query, Request, Response

from api.models.schemas import OCRResponse, HistoryItem, HistoryResponse
from api.ocr_engine import run_ocr

logger = logging.getLogger("pagixo.router.ocr")

router = APIRouter(prefix="/api", tags=["OCR"])

# ─── Thread-safe in-memory history ───────────────────────────────────────────
MAX_HISTORY = 50
_history: deque[HistoryItem] = deque(maxlen=MAX_HISTORY)
_history_lock = threading.Lock()

# ─── Rate Limiting (in-memory, per IP) ───────────────────────────────────────
RATE_LIMIT_MAX = 30           # max requests
RATE_LIMIT_WINDOW_S = 60      # per minute
_rate_tracker: dict = {}       # { ip: [timestamps] }
_rate_lock = threading.Lock()

# Allowed MIME types and extensions
ALLOWED_MIME_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "application/pdf",
}

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "pdf"}

# Magic bytes for file type validation
MAGIC_SIGNATURES = {
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"\xff\xd8\xff": "image/jpeg",
    b"RIFF": "image/webp",      # WebP starts with RIFF...WEBP
    b"%PDF": "application/pdf",
}

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB


def _check_rate_limit(client_ip: str) -> None:
    """Enforce rate limiting: max 30 requests per minute per IP."""
    now = time.time()
    cutoff = now - RATE_LIMIT_WINDOW_S

    with _rate_lock:
        if client_ip not in _rate_tracker:
            _rate_tracker[client_ip] = []

        # Prune old timestamps
        _rate_tracker[client_ip] = [
            t for t in _rate_tracker[client_ip] if t > cutoff
        ]

        if len(_rate_tracker[client_ip]) >= RATE_LIMIT_MAX:
            logger.warning(f"[Pagixo] Rate limit hit for IP: {client_ip}")
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Max {RATE_LIMIT_MAX} requests per minute.",
            )

        _rate_tracker[client_ip].append(now)


def _detect_mime_by_magic(file_bytes: bytes) -> Optional[str]:
    """Detect MIME type from magic bytes (first 8 bytes)."""
    header = file_bytes[:8]
    for sig, mime in MAGIC_SIGNATURES.items():
        if header.startswith(sig):
            # Extra check for WebP: RIFF....WEBP
            if sig == b"RIFF" and len(file_bytes) >= 12:
                if file_bytes[8:12] != b"WEBP":
                    continue
            return mime
    return None


def _validate_file(file: UploadFile) -> str:
    """
    Validate uploaded file type by extension and content type.
    Returns the lowercase file extension.
    Raises HTTPException(422) for invalid files.
    """
    if not file.filename:
        raise HTTPException(status_code=422, detail="Filename is required.")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file type '.{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # Also check content_type if provided
    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        logger.warning(
            f"[Pagixo] MIME type '{file.content_type}' not in allowlist, "
            f"but extension '.{ext}' is valid. Proceeding."
        )

    return ext


def _validate_file_bytes(file_bytes: bytes, ext: str, filename: str) -> None:
    """
    Secondary validation: check magic bytes match the claimed extension.
    Raises HTTPException(422) on mismatch.
    """
    detected_mime = _detect_mime_by_magic(file_bytes)
    if detected_mime is None:
        logger.warning(f"[Pagixo] Could not detect MIME from magic bytes for '{filename}'")
        return  # Allow — some edge cases might not have standard headers

    # Map extension to expected MIME
    ext_to_mime = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp",
        "pdf": "application/pdf",
    }
    expected = ext_to_mime.get(ext)

    if expected and detected_mime != expected:
        logger.warning(
            f"[Pagixo] MIME mismatch: extension='.{ext}' ({expected}) "
            f"but magic bytes say '{detected_mime}' for '{filename}'"
        )
        raise HTTPException(
            status_code=422,
            detail=f"File content does not match extension '.{ext}'. "
                   f"Detected type: {detected_mime}",
        )


def _add_request_id(response: Response) -> str:
    """Generate and attach a request ID to the response."""
    request_id = uuid.uuid4().hex[:12]
    response.headers["X-Request-ID"] = request_id
    return request_id


def _pdf_page_to_image(pdf_bytes: bytes, page_num: int = 0, dpi: int = 200) -> tuple:
    """Convert a single PDF page to a PIL Image."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page = doc.load_page(page_num)
    pix = page.get_pixmap(dpi=dpi)
    img_bytes = pix.tobytes("png")
    img = Image.open(io.BytesIO(img_bytes))
    num_pages = len(doc)
    doc.close()
    return img, num_pages


@router.post("/ocr", response_model=OCRResponse)
async def process_ocr(
    request: Request,
    response: Response,
    file: UploadFile = File(..., description="Image or PDF file to process"),
    model: Optional[str] = Query(default=None, description="Model ID to use"),
    subject: str = Query(default="Auto-detect", description="Subject context"),
    enhance: bool = Query(default=True, description="Whether to auto-enhance"),
):
    """
    Process an uploaded image or PDF through the OCR pipeline.
    
    Supported formats: PNG, JPEG, WebP, PDF
    Max file size: 20MB
    Rate limit: 30 requests/minute per IP
    """
    # Request ID
    req_id = _add_request_id(response)

    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    # Validate file extension
    ext = _validate_file(file)

    start_time = time.time()
    temp_path = None

    try:
        # Read file contents
        file_bytes = await file.read()
        file_size = len(file_bytes)

        # Enforce 20MB limit
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File too large ({file_size / (1024*1024):.1f}MB). Maximum size is 20MB.",
            )

        # Validate magic bytes match extension
        _validate_file_bytes(file_bytes, ext, file.filename)

        num_pages = 1

        if ext == "pdf":
            img, num_pages = _pdf_page_to_image(file_bytes, page_num=0)
            if img.mode == "RGBA":
                img = img.convert("RGB")
            temp_path = os.path.join(
                tempfile.gettempdir(), f"pagixo_api_{uuid.uuid4().hex}.jpg",
            )
            img.save(temp_path, format="JPEG", quality=95)
        else:
            img = Image.open(io.BytesIO(file_bytes))
            if img.mode == "RGBA":
                img = img.convert("RGB")
            temp_path = os.path.join(
                tempfile.gettempdir(), f"pagixo_api_{uuid.uuid4().hex}.jpg",
            )
            img.save(temp_path, format="JPEG", quality=95)

        # Run OCR
        extracted_text, model_used = run_ocr(
            image_path=temp_path,
            model_id=model,
            subject=subject,
            do_enhance=enhance,
        )

        processing_time_ms = int((time.time() - start_time) * 1000)
        response.headers["X-Processing-Time-Ms"] = str(processing_time_ms)

        # Estimate confidence
        text_length = len(extracted_text.strip())
        if text_length == 0:
            confidence = 0.0
        elif text_length < 10:
            confidence = 0.3
        elif text_length < 50:
            confidence = 0.6
        else:
            confidence = 0.85

        ocr_response = OCRResponse(
            status="success",
            text=extracted_text,
            confidence=round(confidence, 2),
            pages=num_pages,
            processing_time_ms=processing_time_ms,
            model_used=model_used,
            filename=file.filename,
        )

        # Store in history
        history_item = HistoryItem(
            id=uuid.uuid4().hex,
            filename=file.filename or "unknown",
            text_preview=extracted_text[:200],
            full_text=extracted_text,
            confidence=round(confidence, 2),
            pages=num_pages,
            processing_time_ms=processing_time_ms,
            model_used=model_used,
            timestamp=datetime.utcnow(),
            file_type=file.content_type,
            file_size_bytes=file_size,
        )

        with _history_lock:
            _history.appendleft(history_item)

        logger.info(
            f"[Pagixo] OCR complete — req={req_id} file={file.filename} "
            f"model={model_used} time={processing_time_ms}ms chars={text_length} "
            f"ip={client_ip}"
        )

        return ocr_response

    except HTTPException:
        raise
    except Exception as e:
        processing_time_ms = int((time.time() - start_time) * 1000)
        logger.error(f"[Pagixo] OCR failed — req={req_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"OCR processing failed: {str(e)}",
        )
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    response: Response,
    limit: int = Query(default=50, ge=1, le=100, description="Max items"),
):
    """Get the last N OCR scan results from in-memory history."""
    _add_request_id(response)

    with _history_lock:
        items = list(_history)[:limit]

    return HistoryResponse(count=len(items), items=items)


@router.delete("/history")
async def clear_history(response: Response):
    """Clear all OCR scan history."""
    _add_request_id(response)

    with _history_lock:
        _history.clear()

    logger.info("[Pagixo] History cleared")
    return {"status": "ok", "message": "History cleared"}


@router.get("/origins")
async def get_origins(response: Response):
    """
    Returns the list of allowed CORS origins.
    Used by the Chrome extension to self-configure.
    """
    _add_request_id(response)

    from api.middleware.cors import get_allowed_origins
    origins = get_allowed_origins()

    return {
        "origins": origins,
        "chrome_extension_pattern": "chrome-extension://*",
        "production": os.getenv("PRODUCTION", "false").lower() == "true",
    }
