# api/routers/chat.py
from fastapi import APIRouter
from api.models.chat_models import ChatRequest, ChatResponse
from api.services.nvidia_nim import call_text_chat, call_vision_chat, VisionChatRequest

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest) -> ChatResponse:
    """
    Text-based chat endpoint.
    Accepts question + OCR context + history.
    Routes to NVIDIA NIM DeepSeek-R1 (text model).
    """
    return await call_text_chat(req)


@router.post("/chat-vision", response_model=ChatResponse)
async def chat_vision_endpoint(req: VisionChatRequest) -> ChatResponse:
    """
    Vision-enabled chat endpoint.
    Accepts question + OCR context + base64 screenshot + history.
    Routes to NVIDIA NIM Llama-3.2-Vision model.
    """
    return await call_vision_chat(req)
