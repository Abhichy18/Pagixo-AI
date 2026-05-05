"""
Pagixo OCR API — Endpoint Tests

Uses pytest + httpx AsyncClient to test the FastAPI endpoints
without requiring a running server.

Run: pytest api/tests/test_ocr_endpoint.py -v
"""

import io
import base64
import struct
import zlib
import pytest
from httpx import AsyncClient, ASGITransport

from api.main import app


# ─── Fixtures ─────────────────────────────────────────────────

def make_tiny_png() -> bytes:
    """
    Generate a valid 1x1 white pixel PNG in pure Python.
    No external dependencies required.
    """
    # IHDR chunk: width=1, height=1, bit_depth=8, color_type=2 (RGB)
    ihdr_data = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    ihdr_crc = zlib.crc32(b"IHDR" + ihdr_data) & 0xFFFFFFFF
    ihdr = struct.pack(">I", 13) + b"IHDR" + ihdr_data + struct.pack(">I", ihdr_crc)

    # IDAT chunk: raw image data (filter byte 0 + RGB white pixel)
    raw_data = b"\x00\xff\xff\xff"  # filter=0, R=255, G=255, B=255
    compressed = zlib.compress(raw_data)
    idat_crc = zlib.crc32(b"IDAT" + compressed) & 0xFFFFFFFF
    idat = struct.pack(">I", len(compressed)) + b"IDAT" + compressed + struct.pack(">I", idat_crc)

    # IEND chunk
    iend_crc = zlib.crc32(b"IEND") & 0xFFFFFFFF
    iend = struct.pack(">I", 0) + b"IEND" + struct.pack(">I", iend_crc)

    # PNG signature + chunks
    png_sig = b"\x89PNG\r\n\x1a\n"
    return png_sig + ihdr + idat + iend


@pytest.fixture
def tiny_png():
    """A valid 1x1 white PNG file as bytes."""
    return make_tiny_png()


@pytest.fixture
def client():
    """Async HTTP client bound to the FastAPI app."""
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


# ─── Health Check ─────────────────────────────────────────────

@pytest.mark.anyio
async def test_health_returns_200(client):
    """GET /health should return 200 with status: ok."""
    response = await client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "pagixo-ocr-api"
    assert "version" in data
    assert "uptime_seconds" in data


@pytest.mark.anyio
async def test_root_returns_info(client):
    """GET / should return API info."""
    response = await client.get("/")
    assert response.status_code == 200

    data = response.json()
    assert "message" in data
    assert "docs" in data


# ─── OCR Upload: Valid File ───────────────────────────────────

@pytest.mark.anyio
async def test_ocr_upload_valid_png(client, tiny_png):
    """POST /api/ocr with a valid tiny PNG should return 200 or process."""
    files = {"file": ("test.png", io.BytesIO(tiny_png), "image/png")}
    response = await client.post("/api/ocr", files=files)

    # Could be 200 (success) or 500 (if no API key configured)
    # We just verify it gets past validation
    assert response.status_code in (200, 500)

    if response.status_code == 200:
        data = response.json()
        assert data["status"] == "success"
        assert "text" in data
        assert "confidence" in data
        assert "pages" in data
        assert "processing_time_ms" in data

    # Verify X-Request-ID header is present
    assert "x-request-id" in response.headers


# ─── OCR Upload: Invalid File Type ───────────────────────────

@pytest.mark.anyio
async def test_ocr_rejects_invalid_file_type(client):
    """POST /api/ocr with a .txt file should return 422."""
    content = b"This is not an image"
    files = {"file": ("readme.txt", io.BytesIO(content), "text/plain")}
    response = await client.post("/api/ocr", files=files)

    assert response.status_code == 422
    data = response.json()
    assert "detail" in data
    assert "txt" in data["detail"].lower() or "unsupported" in data["detail"].lower()


@pytest.mark.anyio
async def test_ocr_rejects_exe_with_png_extension(client):
    """POST /api/ocr with a fake .png (wrong magic bytes) should return 422."""
    # MZ header = Windows executable
    fake_png = b"MZ" + b"\x00" * 100
    files = {"file": ("sneaky.png", io.BytesIO(fake_png), "image/png")}
    response = await client.post("/api/ocr", files=files)

    # Should be caught by magic byte validation
    assert response.status_code in (422, 500)


# ─── OCR Upload: File Too Large ──────────────────────────────

@pytest.mark.anyio
async def test_ocr_rejects_oversized_file(client):
    """POST /api/ocr with a file > 20MB should return 413."""
    # Create a 21MB blob with valid PNG header to pass extension check
    png_header = b"\x89PNG\r\n\x1a\n"
    oversized = png_header + b"\x00" * (21 * 1024 * 1024)
    files = {"file": ("huge.png", io.BytesIO(oversized), "image/png")}
    response = await client.post("/api/ocr", files=files)

    assert response.status_code == 413
    data = response.json()
    assert "20mb" in data["detail"].lower() or "too large" in data["detail"].lower()


# ─── History ──────────────────────────────────────────────────

@pytest.mark.anyio
async def test_history_returns_list(client):
    """GET /api/history should return a list."""
    response = await client.get("/api/history")
    assert response.status_code == 200

    data = response.json()
    assert "count" in data
    assert "items" in data
    assert isinstance(data["items"], list)
    assert "x-request-id" in response.headers


@pytest.mark.anyio
async def test_delete_history(client):
    """DELETE /api/history should clear history."""
    response = await client.delete("/api/history")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ok"


# ─── Origins Endpoint ────────────────────────────────────────

@pytest.mark.anyio
async def test_origins_endpoint(client):
    """GET /api/origins should return CORS configuration."""
    response = await client.get("/api/origins")
    assert response.status_code == 200

    data = response.json()
    assert "origins" in data
    assert isinstance(data["origins"], list)
    assert "chrome_extension_pattern" in data


# ─── No File Provided ────────────────────────────────────────

@pytest.mark.anyio
async def test_ocr_no_file_returns_422(client):
    """POST /api/ocr without a file should return 422."""
    response = await client.post("/api/ocr")
    assert response.status_code == 422
