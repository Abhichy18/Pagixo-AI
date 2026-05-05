# ─────────────────────────────────────────────────────────────
# Pagixo OCR — FastAPI Bridge Dockerfile
# ─────────────────────────────────────────────────────────────

FROM python:3.11-slim

WORKDIR /app

# Install system deps for OpenCV and image processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY api/requirements.txt ./api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt

# Copy API source
COPY api/ ./api/

# Copy shared modules the API depends on
COPY enhance_image.py ./enhance_image.py
COPY .env ./.env

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
