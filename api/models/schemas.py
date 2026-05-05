"""
Pydantic models for the Pagixo OCR API.
Defines request/response schemas for all endpoints.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class HealthResponse(BaseModel):
    """Response schema for the /health endpoint."""
    status: str = Field(default="ok", description="Service health status")
    service: str = Field(default="pagixo-ocr-api", description="Service identifier")
    version: str = Field(default="1.0.0", description="API version")
    uptime_seconds: Optional[float] = Field(default=None, description="Uptime in seconds since startup")


class OCRResponse(BaseModel):
    """Response schema for the /api/ocr endpoint."""
    status: str = Field(description="Processing status: 'success' or 'error'")
    text: str = Field(description="Extracted OCR text content")
    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="OCR confidence score (0.0 to 1.0)"
    )
    pages: int = Field(default=1, ge=1, description="Number of pages processed")
    processing_time_ms: int = Field(
        default=0,
        ge=0,
        description="Processing time in milliseconds"
    )
    model_used: Optional[str] = Field(default=None, description="Model ID used for OCR")
    filename: Optional[str] = Field(default=None, description="Original filename")


class HistoryItem(BaseModel):
    """Schema for a single OCR history entry."""
    id: str = Field(description="Unique identifier for this scan")
    filename: str = Field(description="Original filename that was scanned")
    text_preview: str = Field(description="First 200 characters of extracted text")
    full_text: str = Field(description="Complete extracted text")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    pages: int = Field(default=1, ge=1)
    processing_time_ms: int = Field(default=0, ge=0)
    model_used: Optional[str] = Field(default=None)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    file_type: Optional[str] = Field(default=None, description="MIME type of the uploaded file")
    file_size_bytes: Optional[int] = Field(default=None, description="Size of uploaded file in bytes")


class HistoryResponse(BaseModel):
    """Response schema for the /api/history endpoint."""
    count: int = Field(description="Number of history items returned")
    items: List[HistoryItem] = Field(description="List of scan history entries")


class ErrorResponse(BaseModel):
    """Standard error response."""
    status: str = Field(default="error")
    detail: str = Field(description="Human-readable error message")
    error_code: Optional[str] = Field(default=None, description="Machine-readable error code")
