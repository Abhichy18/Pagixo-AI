# Pagixo OCR — Chrome Extension

A Chrome Extension that scans any image or PDF for OCR using the Pagixo OCR engine, right from your browser.

## 🚀 Quick Start

### Prerequisites

- **Python 3.10+** with `pip`
- **Node.js 18+** with `npm`
- **Google Chrome** (or any Chromium browser)
- A `.env` file at the project root with your API keys:
  ```
  NVIDIA_API_KEY=your_nvidia_key
  OPENROUTER_API_KEY=your_openrouter_key
  ```

### Step 1 — Start the Backend Services

**Option A: Local dev (no Docker)**

```bash
# Windows
start-dev.bat

# Linux / Mac
chmod +x start-dev.sh
./start-dev.sh
```

This starts both services:
| Service | URL | Purpose |
|---------|-----|---------|
| Streamlit | http://localhost:8501 | Math OCR web app |
| FastAPI   | http://localhost:8000 | Chrome Extension API bridge |

**Option B: Docker**

```bash
docker-compose up
```

### Step 2 — Build the Extension

```bash
cd chrome-extension
npm install
npm run build
```

### Step 3 — Load in Chrome

1. Open **chrome://extensions** in your browser
2. Enable **Developer Mode** (top-right toggle)
3. Click **"Load unpacked"**
4. Select the `chrome-extension/` folder (NOT `dist/` — the manifest is at root)
5. Pin the **Pagixo OCR Scanner** extension to your toolbar

### Step 4 — Use It!

| Action | How |
|--------|-----|
| **Scan an image** | Right-click any image → **🔍 Scan with Pagixo OCR** |
| **Scan a linked image** | Right-click a link to an image → **🔍 Scan linked image** |
| **Capture area** | Right-click the page → **📄 Scan visible area**, then drag to select |
| **Drag & drop** | Drag any image or PDF file onto a webpage |
| **Upload file** | Click the extension icon → **Scan Image** |

Results appear in the **side panel** with Raw Text, Markdown, and LaTeX views.

---

## 🏗️ Project Structure

```
OCR_DETECTION/
├── app.py                    ← Streamlit OCR app (untouched)
├── enhance_image.py          ← Image preprocessing (untouched)
├── .env                      ← API keys
├── start-dev.bat / .sh       ← Start both services
├── docker-compose.yml        ← Docker orchestration
│
├── api/                      ← FastAPI OCR bridge (port 8000)
│   ├── main.py               ← App + lifespan + CORS
│   ├── ocr_engine.py         ← OCR pipeline adapter
│   ├── routers/ocr.py        ← POST /api/ocr, GET /api/history
│   ├── middleware/cors.py     ← CORS for chrome-extension://
│   └── models/schemas.py     ← Pydantic response models
│
└── chrome-extension/         ← Manifest V3 Chrome Extension
    ├── manifest.json          ← Extension config
    ├── package.json           ← Build deps
    ├── vite.config.js         ← Vite multi-entry build
    ├── assets/                ← Extension icons (16/48/128)
    ├── dist/                  ← Built output (auto-generated)
    └── src/
        ├── background/        ← Service worker (context menus, API calls)
        ├── content/           ← Drag/drop overlay + area capture
        ├── popup/             ← React popup (320×480)
        ├── sidepanel/         ← React results viewer
        └── shared/            ← Constants, API client, storage, icons
```

---

## 🔧 Development

### Rebuild on changes

```bash
cd chrome-extension
npm run dev    # Watches for changes and rebuilds
```

After rebuilding, go to **chrome://extensions** and click the **reload ↻** button on the Pagixo extension.

### API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/ocr` | Upload file for OCR |
| GET | `/api/history` | Recent scan results |
| DELETE | `/api/history` | Clear history |

### Troubleshooting

- **Extension shows "Server Offline"**: Make sure the FastAPI server is running on port 8000
- **CORS errors**: The API allows `chrome-extension://` origins in dev mode
- **Build fails**: Run `npm install` first, ensure Node.js 18+
- **Icons missing**: Run `npm run generate:icons` (requires `canvas` package)

---

## 📄 License

Part of the Pagixo OCR project.
