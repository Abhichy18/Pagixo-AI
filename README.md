# 📖 Advanced Math & Text OCR System

An enterprise-grade, highly precise Optical Character Recognition (OCR) application built with **Streamlit** and powered by **OpenRouter Vision Models** (Qwen 2.5, Nemotron, Baidu Qianfan).

This application specializes in extracting complex mathematical equations, structured text, and technical diagrams from images and PDFs. It features a robust rendering pipeline that seamlessly translates raw OCR output into clean, beautifully formatted LaTeX.

## ✨ Key Features

- **Multi-Model Inference:** Easily toggle between Free utility models (Nemotron/Baidu) and Paid high-precision models (Qwen 2.5 VL 72B).
- **Intelligent LaTeX Pipeline:** Auto-corrects common LLM hallucinations (e.g., malformed `\sqrt` or array tags) and smartly parses block math.
- **Interactive Text Spotting:** Generates beautifully rendered, semi-transparent green bounding boxes on the original image, cross-linked via dynamic Number Badges to the extracted text.
- **PDF & Camera Support:** Upload multi-page PDFs, take photos directly from your device, or simply paste an image via the keyboard.
- **OpenCV Image Enhancement:** Built-in auto-enhancement filters improve contrast and sharpness for blurry documents before extraction.
- **Export & Download:** One-click downloads for raw Markdown (`.md`) or compiled LaTeX (`.tex`), plus a "Copy to Clipboard" utility.

## 🚀 Quick Start

### 1. Prerequisites
Ensure you have Python 3.8+ installed.

```bash
# Clone the repository
git clone <your-repo-url>
cd OCR_DETECTION

# Install dependencies
pip install -r requirements.txt
```

### 2. Environment Setup
Create a `.env` file in the root directory and add your OpenRouter API Key:
```env
OPENROUTER_API_KEY=your_api_key_here
```

### 3. Run the Application
Launch the Streamlit server:
```bash
streamlit run app.py
```

## 🛠️ Tech Stack

- **Frontend/UI:** [Streamlit](https://streamlit.io/)
- **Vision APIs:** OpenRouter (OpenAI Python SDK)
- **Image Processing:** Pillow (PIL), OpenCV, PyMuPDF (fitz)
- **Math Rendering:** KaTeX / MathJax via Streamlit Markdown

## 📌 Usage Workflows

1. **Full Page OCR:** Select this mode when you want to convert an entire document into a single coherent Markdown/LaTeX output.
2. **Text Spotting:** Select this mode when you want the AI to localize specific equations or text chunks. The app will return bounding box coordinates and map them visually.

---
*Built for absolute precision in educational and technical extraction.*
