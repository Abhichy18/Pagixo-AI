"""
OCR Engine Adapter for the FastAPI Bridge.

This module wraps the existing OCR inference logic from the root app.py 
WITHOUT modifying it. It extracts and re-exposes the core functions 
(inference_with_api, enhance_image, encode_image) so the FastAPI router
can call them cleanly.

IMPORTANT: This does NOT import app.py directly (it would trigger Streamlit).
Instead, it reimplements the core OCR pipeline using the same API calls and logic.
"""

import os
import io
import sys
import base64
import json
import time
import logging
import tempfile
from typing import Optional, Tuple

import requests
from PIL import Image
from openai import OpenAI
from dotenv import load_dotenv

# Ensure the project root is on sys.path so we can import enhance_image
PROJECT_ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, PROJECT_ROOT)

from enhance_image import enhance_image  # noqa: E402

# Load environment variables from the root .env file
load_dotenv(os.path.join(PROJECT_ROOT, ".env"), override=True)

logger = logging.getLogger("pagixo.ocr_engine")


# ─── Model Configuration ─────────────────────────────────────────────────────

MODEL_MAP = {
    "baidu-ocr":      "baidu/qianfan-ocr-fast:free",
    "nemotron-nano":  "nvidia/nemotron-nano-12b-v2-vl:free",
    "qwen-2.5-vl":   "qwen/qwen-2.5-vl-72b-instruct",
    "nemotron-ocr":  "nvidia/nemotron-ocr-v1",
}

# Primary: Baidu Qianfan OCR Fast (free, OpenRouter)
# Fallback 1: Nemotron Nano (free, OpenRouter)
# Fallback 2: NVIDIA Nemotron OCR v1 (NVIDIA direct API)
DEFAULT_MODEL_ID = "baidu/qianfan-ocr-fast:free"
FALLBACK_CHAIN = [
    "baidu/qianfan-ocr-fast:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "nvidia/nemotron-ocr-v1",
]

# System prompts for different modes
GENERAL_SYS_PROMPT = (
    "You are a highly precise, versatile OCR engine. "
    "Your purpose is pixel-perfect transcription of any image content."
)

MATH_SYS_PROMPT = """You are an elite mathematical OCR engine with PhD-level precision. 
Your sole purpose is pixel-perfect LaTeX transcription.

ABSOLUTE RULES:
1. NEVER paraphrase, simplify, or interpret — transcribe EXACTLY what you see
2. NEVER skip terms, even if the expression looks repetitive
3. NEVER guess — if a symbol is ambiguous, use the most mathematically consistent reading
4. Preserve ALL nested structures: parentheses depth, bracket types, operator order
5. Fraction rule: numerator is ALWAYS top, denominator is ALWAYS bottom — never swap
6. Floor brackets: use \\lfloor \\rfloor — never approximate as | or [
7. Ceiling brackets: use \\lceil \\rceil
8. Absolute value: use \\left| \\right|
9. Large brackets: use \\left( \\right), \\left[ \\right], \\left\\{ \\right\\} with correct \\bigg sizing
10. Exponents with complex expressions: use full {} grouping e^{\\frac{a}{b}(cx-d)}"""

GENERAL_PROMPT = """Extract all text, numbers, and any other content from this image exactly as it appears.
1. Preserve all languages (e.g. English, Hindi, etc.) precisely.
2. Preserve capitalization and punctuation.
3. If there are tables or lists, format them using Markdown.
Output ONLY the extracted content without any commentary or conversational filler."""

MATH_PROMPT = """Perform pixel-perfect LaTeX extraction of ALL mathematical content in this image.

EXTRACTION PROTOCOL:
1. SCAN the entire image top-to-bottom, left-to-right — miss nothing
2. For each mathematical expression:
   - Identify ALL terms including signs (+ or -)
   - Check fraction orientation: top=numerator, bottom=denominator
   - Verify bracket matching: every \\left( must have \\right)
   - Count nested levels carefully

3. CRITICAL CHECKS before outputting:
   □ Are all fractions correctly oriented? (not flipped)
   □ Are floor/ceiling brackets \\lfloor \\rfloor vs \\lceil \\rceil correctly identified?
   □ Are subscripts and superscripts on the correct symbol?
   □ Are negative signs preserved on every term?
   □ Are all \\min \\max \\cos \\sin \\log arguments complete?

4. FORMAT rules:
   - Wrap ALL math in $$ ... $$ for block equations
   - Use \\begin{array}{l} for multi-line expressions
   - Use \\\\ for line breaks within arrays
   - Use \\quad for alignment spacing
   - Non-math text: output as plain text above/below the math block

5. SELF-CHECK: After extracting, mentally verify the first and last term 
   of each major expression match the image exactly.

Output ONLY the extracted content — no explanations, no commentary."""


# ─── Core Functions ───────────────────────────────────────────────────────────

def encode_image(image_path: str) -> str:
    """Read an image file and return its base64-encoded string."""
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def _call_nvidia_ocr(image_path: str) -> str:
    """
    Call the NVIDIA Nemotron OCR v1 API directly.
    Mirrors the logic from app.py lines 268-339.
    """
    api_key = os.getenv("NVIDIA_API_KEY")
    if not api_key:
        raise ValueError("NVIDIA_API_KEY not found in environment variables.")

    invoke_url = "https://ai.api.nvidia.com/v1/cv/nvidia/nemotron-ocr-v1"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    }

    # Resize/compress image to stay within NVIDIA's base64 limit (~180k chars)
    img = Image.open(image_path)
    if img.mode != "RGB":
        img = img.convert("RGB")

    quality = 95
    while True:
        buffered = io.BytesIO()
        img.save(buffered, format="JPEG", quality=quality)
        base64_image = base64.b64encode(buffered.getvalue()).decode("utf-8")
        if len(base64_image) < 180000 or quality <= 10:
            break
        quality -= 15
        if quality < 30:
            img = img.resize((int(img.width * 0.8), int(img.height * 0.8)))

    payload = {
        "input": [
            {
                "type": "image_url",
                "url": f"data:image/jpeg;base64,{base64_image}",
            }
        ]
    }

    response = requests.post(invoke_url, headers=headers, json=payload, timeout=60)
    if response.status_code != 200:
        raise Exception(f"NVIDIA API returned {response.status_code}: {response.text}")

    res_json = response.json()

    # Extract text from NVIDIA's response structure
    extracted_texts = []
    if "data" in res_json and isinstance(res_json["data"], list):
        for item in res_json["data"]:
            if "text_detections" in item and isinstance(item["text_detections"], list):
                for detection in item["text_detections"]:
                    if "text_prediction" in detection and "text" in detection["text_prediction"]:
                        extracted_texts.append(detection["text_prediction"]["text"])

    if extracted_texts:
        return "\n".join(extracted_texts)

    # Fallback: return raw JSON
    return json.dumps(res_json)


def _call_openrouter_ocr(image_path: str, prompt: str, sys_prompt: str, model_id: str) -> str:
    """
    Call the OpenRouter API for OCR.
    Mirrors the logic from app.py lines 341-381.
    """
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY not found in environment variables.")

    base64_image = encode_image(image_path)
    client = OpenAI(
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
    )

    messages = [
        {
            "role": "system",
            "content": [{"type": "text", "text": sys_prompt}],
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{base64_image}",
                        "detail": "high",
                    },
                },
                {"type": "text", "text": prompt},
            ],
        },
    ]

    completion = client.chat.completions.create(
        model=model_id,
        messages=messages,
        max_tokens=2000,
        temperature=0.1,
    )

    content = completion.choices[0].message.content
    if content is None:
        raise Exception(
            "API returned an empty response. The model may be overloaded "
            "or the image was blocked by safety filters."
        )
    return content


def run_ocr(
    image_path: str,
    model_id: Optional[str] = None,
    subject: str = "Auto-detect",
    do_enhance: bool = True,
) -> Tuple[str, str]:
    """
    Main OCR pipeline entry point for the FastAPI bridge.

    Args:
        image_path: Absolute path to the image/page file.
        model_id: Model identifier (key from MODEL_MAP or full model string).
                  Defaults to baidu/qianfan-ocr-fast:free.
        subject: Subject context for prompt selection.
        do_enhance: Whether to run image enhancement before OCR.

    Returns:
        Tuple of (extracted_text, model_id_used)
    """
    # Resolve model ID
    if model_id and model_id in MODEL_MAP:
        resolved_model = MODEL_MAP[model_id]
    elif model_id:
        resolved_model = model_id
    else:
        resolved_model = DEFAULT_MODEL_ID

    logger.info(f"[Pagixo] OCR request — model={resolved_model}, subject={subject}, enhance={do_enhance}")

    # Optional image enhancement
    if do_enhance:
        try:
            img = Image.open(image_path)
            if img.mode == "RGBA":
                img = img.convert("RGB")
            enhanced = enhance_image(img)
            enhanced.save(image_path)
            logger.info("[Pagixo] Image enhanced successfully")
        except Exception as e:
            logger.warning(f"[Pagixo] Enhancement failed (using original): {e}")

    # Choose prompt based on subject
    if subject in ("Auto-detect", "Other"):
        sys_prompt = GENERAL_SYS_PROMPT
        prompt = GENERAL_PROMPT
    else:
        sys_prompt = MATH_SYS_PROMPT
        prompt = MATH_PROMPT

    # Build the models-to-try list
    # If a specific model was requested, try it first then fall through the chain
    if model_id:
        models_to_try = [resolved_model] + [
            m for m in FALLBACK_CHAIN if m != resolved_model
        ]
    else:
        models_to_try = FALLBACK_CHAIN

    last_error = None
    for attempt_model in models_to_try:
        try:
            logger.info(f"[Pagixo] Trying model: {attempt_model}")
            if attempt_model == "nvidia/nemotron-ocr-v1":
                text = _call_nvidia_ocr(image_path)
            else:
                text = _call_openrouter_ocr(image_path, prompt, sys_prompt, attempt_model)

            if text and text.strip():
                logger.info(f"[Pagixo] Success with model: {attempt_model}")
                return text, attempt_model
            else:
                logger.warning(f"[Pagixo] Empty response from {attempt_model}, trying fallback")
                last_error = Exception(f"{attempt_model} returned empty text")

        except Exception as e:
            logger.warning(f"[Pagixo] Model {attempt_model} failed: {e} — trying fallback")
            last_error = e
            continue

    # All models failed
    raise Exception(
        f"All OCR models failed. Last error: {last_error}"
    )
