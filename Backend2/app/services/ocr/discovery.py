import os
import shutil
import subprocess
from typing import Optional, Tuple, Dict, Any
import pytesseract
from ...core.config import settings
from ...core.logging import logger


def find_tesseract_binary(explicit_path: Optional[str] = None) -> Tuple[Optional[str], Optional[str], bool]:
    """
    Robust discovery mechanism for Tesseract OCR binary on Windows and Unix systems.
    
    Discovery Order:
    1. explicit_path argument
    2. TESSERACT_CMD environment variable
    3. settings.TESSERACT_CMD configuration
    4. Windows standard installation locations
    5. System PATH via shutil.which()
    """
    candidates = []

    if explicit_path and explicit_path.strip():
        candidates.append(explicit_path.strip())

    env_cmd = os.environ.get("TESSERACT_CMD")
    if env_cmd and env_cmd.strip():
        candidates.append(env_cmd.strip())

    if settings.TESSERACT_CMD and settings.TESSERACT_CMD.strip():
        candidates.append(settings.TESSERACT_CMD.strip())

    # Windows Standard Installation Paths
    win_common_paths = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe"),
        os.path.expandvars(r"%USERPROFILE%\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"),
        r"C:\tools\tesseract\tesseract.exe",
        r"C:\tesseract\tesseract.exe",
        r"C:\ProgramData\chocolatey\bin\tesseract.exe",
        r"C:\Scoop\shims\tesseract.exe",
    ]
    candidates.extend(win_common_paths)

    # PATH checks
    which_tess = shutil.which("tesseract")
    if which_tess:
        candidates.append(which_tess)
    which_tess_exe = shutil.which("tesseract.exe")
    if which_tess_exe:
        candidates.append(which_tess_exe)

    for cand in candidates:
        if not cand:
            continue
        # Normalize path
        cand_path = os.path.normpath(cand)
        if os.path.exists(cand_path) and not os.path.isdir(cand_path):
            try:
                # Test execution: tesseract --version
                proc = subprocess.run(
                    [cand_path, "--version"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                    check=False,
                )
                if proc.returncode == 0:
                    first_line = proc.stdout.splitlines()[0] if proc.stdout else "tesseract (version unknown)"
                    pytesseract.pytesseract.tesseract_cmd = cand_path
                    
                    # Auto-set TESSDATA_PREFIX if tessdata folder is adjacent to binary
                    tessdata_dir = os.path.join(os.path.dirname(cand_path), "tessdata")
                    if os.path.exists(tessdata_dir) and not os.environ.get("TESSDATA_PREFIX"):
                        os.environ["TESSDATA_PREFIX"] = tessdata_dir

                    return cand_path, first_line.strip(), True
            except Exception as e:
                logger.debug(f"Candidate {cand_path} failed version execution check: {str(e)}")

    return None, None, False


def check_ocr_engine(explicit_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Evaluates OCR engine availability and returns diagnostic metadata.
    """
    path, version, available = find_tesseract_binary(explicit_path)
    return {
        "available": available,
        "engine": "tesseract",
        "version": version or "Not Installed",
        "path_configured": bool(os.environ.get("TESSERACT_CMD") or (settings.TESSERACT_CMD and settings.TESSERACT_CMD != "tesseract")),
        "executable_path": path,
    }
