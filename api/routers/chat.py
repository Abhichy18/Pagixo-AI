import os
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openai import OpenAI

logger = logging.getLogger("pagixo.chat")
router = APIRouter(prefix="/api/chat", tags=["AI Chat"])

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    question: str
    context: str
    history: Optional[List[ChatMessage]] = []

class ChatResponse(BaseModel):
    answer: str
    model: str

@router.post("", response_model=ChatResponse)
async def ask_pagixo_ai(request: ChatRequest):
    """
    Endpoint to process chat questions about the OCR extracted text using DeepSeek-R1
    via NVIDIA NIM API.
    """
    api_key = os.getenv("NVIDIA_API_KEY")
    if not api_key:
        logger.error("NVIDIA_API_KEY is not configured.")
        raise HTTPException(status_code=500, detail="NVIDIA API Key not configured on the server.")

    client = OpenAI(
        api_key=api_key,
        base_url="https://integrate.api.nvidia.com/v1"
    )

    # Build the system prompt
    system_prompt = (
        "You are Pagixo AI, a highly intelligent and helpful assistant that helps users understand document text. "
        "The user has just scanned a document using OCR. Below is the exact text they extracted. "
        "Answer their question clearly, concisely, and accurately based on the text. "
        "If you need to use mathematical equations in your response, ALWAYS format them as LaTeX. "
        "Use $$ for block equations and $ for inline equations.\n\n"
        f"--- EXTRACTED DOCUMENT TEXT ---\n{request.context}\n--- END TEXT ---"
    )

    messages = [{"role": "system", "content": system_prompt}]
    
    # Append chat history if provided
    if request.history:
        for msg in request.history:
            messages.append({"role": msg.role, "content": msg.content})
            
    # Add current question
    messages.append({"role": "user", "content": request.question})

    try:
        # We use DeepSeek-R1 because it is an elite reasoning model available on the free tier
        completion = client.chat.completions.create(
            model="deepseek-ai/deepseek-r1",
            messages=messages,
            max_tokens=2048,
            temperature=0.3
        )
        
        answer = completion.choices[0].message.content
        return ChatResponse(answer=answer, model="deepseek-ai/deepseek-r1")
        
    except Exception as e:
        logger.error(f"Error calling NVIDIA NIM Chat API: {e}")
        raise HTTPException(status_code=500, detail="Error communicating with the Pagixo AI model.")
