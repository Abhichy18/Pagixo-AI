# api/models/chat_models.py
from pydantic import BaseModel, Field
from typing import Optional, List


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=4000)
    context: str = Field(default="", description="OCR-extracted text from the page")
    history: List[ChatMessage] = Field(default=[], description="Previous chat turns")
    page_url: Optional[str] = Field(default=None, description="URL of scanned page")
    scan_type: Optional[str] = Field(default="unknown")  # "upload" | "capture" | "visible_page"


class ChatResponse(BaseModel):
    answer: str
    model: str
    tokens_used: int
    error: Optional[str] = None
