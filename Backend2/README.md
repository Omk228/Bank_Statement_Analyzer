# Enterprise Universal Bank Statement Analyzer (Backend2)

High-precision, multi-engine bank statement analysis service in Python (FastAPI).

---

## Windows Setup & Tesseract OCR Installation

### 1. Install Tesseract OCR
Install Tesseract 5.x on Windows using one of the following methods:

- **Via Winget (Recommended)**:
  ```powershell
  winget install --id UB-Mannheim.TesseractOCR
  ```
- **Via Manual Installer**:
  Download and run the 64-bit installer from the official UB-Mannheim repository:
  [https://github.com/UB-Mannheim/tesseract/wiki](https://github.com/UB-Mannheim/tesseract/wiki)

### 2. Verify Installation
Open PowerShell / Command Prompt and verify:
```bash
tesseract --version
```
Expected output:
```
tesseract v5.4.0 (or v5.x)
```

### 3. Optional Environment Configuration
If Tesseract is installed in a custom location, add `TESSERACT_CMD` to your `.env` file:
```ini
TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
```
*(If omitted, Backend2 automatically searches standard Windows install paths and system PATH).*

### 4. Start the Backend Server
From `Backend2/`:
```bash
python run.py
```
Or from root:
```bash
npm run dev:py
```

### 5. Verify OCR Health via API
Check the OCR diagnostic health endpoint:
```bash
curl http://127.0.0.1:8000/api/v1/health/ocr
```
Response:
```json
{
  "ocr": {
    "available": true,
    "engine": "tesseract",
    "version": "tesseract v5.4.0.20240606",
    "path_configured": true,
    "executable_path": "C:\\Users\\...\\Tesseract-OCR\\tesseract.exe"
  }
}
```

---

## Running Automated Tests
```bash
python -m pytest Backend2/tests -v
```
