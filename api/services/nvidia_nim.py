# api/services/nvidia_nim.py
import os
import base64
from typing import Optional
from openai import AsyncOpenAI
from api.models.chat_models import ChatRequest, ChatResponse, ChatMessage
from pydantic import BaseModel, Field
from typing import List

NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
TEXT_MODEL = "deepseek-ai/deepseek-r1"
VISION_MODEL = "meta/llama-3.2-11b-vision-instruct"


def get_client() -> AsyncOpenAI:
    api_key = os.environ.get("NVIDIA_API_KEY")
    if not api_key:
        raise RuntimeError("NVIDIA_API_KEY not set in environment")
    return AsyncOpenAI(base_url=NVIDIA_BASE_URL, api_key=api_key)


def build_system_prompt(req: ChatRequest) -> str:
    base = (
        "You are Pagixo AI, an intelligent assistant built into the Pagixo OCR Chrome extension. "
        "You help users understand, analyze, and act on content they have scanned or captured from their screen.\n\n"
    )

    if req.context and req.context.strip():
        base += (
            f"The user has extracted the following text from their screen using OCR:\n\n"
            f"--- EXTRACTED TEXT START ---\n{req.context.strip()}\n--- EXTRACTED TEXT END ---\n\n"
        )
        if req.page_url:
            base += f"This was captured from: {req.page_url}\n"
        if req.scan_type == "visible_page":
            base += (
                "The entire visible webpage was scanned. "
                "If the user asks about forms, tables, or UI elements, refer directly to the extracted text above.\n"
            )
        elif req.scan_type == "capture":
            base += "The user drew a region on screen to capture this specific area.\n"
        elif req.scan_type == "upload":
            base += "The user uploaded a document or image file.\n"
    else:
        base += (
            "No OCR text has been extracted yet. "
            "If the user asks about a document, politely prompt them to scan it first using one of the "
            "three scan options (Upload Document, Capture Area, or Scan Visible Page).\n"
        )

    base += (
        "\nIMPORTANT INSTRUCTIONS:\n"
        "- Be concise but complete. Use markdown formatting in your response.\n"
        "- For forms: list each field with its label and a suggested value or instruction.\n"
        "- For math: use LaTeX notation wrapped in $...$ for inline and $$...$$ for block equations.\n"
        "- For translation: identify the source language automatically.\n"
        "- Always ground your answer in the extracted text provided. Do not hallucinate content.\n"
        "- If asked something unrelated to the extracted text, still help but note it's outside the scanned content.\n"
    )
    return base


async def call_text_chat(req: ChatRequest) -> ChatResponse:
    client = get_client()
    system_prompt = build_system_prompt(req)

    messages = [{"role": "system", "content": system_prompt}]

    for msg in req.history[-6:]:
        messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": req.question})

    try:
        completion = await client.chat.completions.create(
            model=TEXT_MODEL,
            messages=messages,
            temperature=0.3,
            max_tokens=2048,
        )
        answer = completion.choices[0].message.content
        tokens = completion.usage.total_tokens if completion.usage else 0
        return ChatResponse(answer=answer, model=TEXT_MODEL, tokens_used=tokens)

    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg or "rate" in error_msg.lower():
            return ChatResponse(
                answer="⏳ NVIDIA NIM is rate-limited right now. Please wait a few seconds and try again.",
                model=TEXT_MODEL,
                tokens_used=0,
                error="rate_limited"
            )
        return ChatResponse(
            answer="❌ Something went wrong with the AI service. Please try again.",
            model=TEXT_MODEL,
            tokens_used=0,
            error=error_msg
        )


# ── Vision Support ──────────────────────────────────────────────────────────────

class VisionChatRequest(ChatRequest):
    image_base64: Optional[str] = None
    image_media_type: str = "image/png"


async def call_vision_chat(req: VisionChatRequest) -> ChatResponse:
    client = get_client()
    system_prompt = build_system_prompt(req)

    content = []

    if req.image_base64:
        content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:{req.image_media_type};base64,{req.image_base64}"
            }
        })

    content.append({"type": "text", "text": req.question})

    messages = [
        {"role": "system", "content": system_prompt},
        *[{"role": m.role, "content": m.content} for m in req.history[-4:]],
        {"role": "user", "content": content}
    ]

    try:
        completion = await client.chat.completions.create(
            model=VISION_MODEL,
            messages=messages,
            temperature=0.3,
            max_tokens=2048,
        )
        answer = completion.choices[0].message.content
        tokens = completion.usage.total_tokens if completion.usage else 0
        return ChatResponse(answer=answer, model=VISION_MODEL, tokens_used=tokens)

    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg:
            return ChatResponse(
                answer="⏳ Rate limited. Please wait a moment and retry.",
                model=VISION_MODEL, tokens_used=0, error="rate_limited"
            )
        return ChatResponse(
            answer="❌ Vision API error. Try again or use text-only mode.",
            model=VISION_MODEL, tokens_used=0, error=error_msg
        )
