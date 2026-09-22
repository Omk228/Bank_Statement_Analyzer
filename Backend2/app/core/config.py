import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Universal Bank Statement Analyzer"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "production"
    DEBUG: bool = False
    
    # API & Server
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "*"]
    
    # Security Limits
    MAX_FILE_SIZE_BYTES: int = 25 * 1024 * 1024  # 25MB
    MAX_PAGE_COUNT: int = 100
    ALLOWED_MIME_TYPES: List[str] = ["application/pdf"]
    
    # OCR & Rendering
    OCR_DPI: int = 300
    OCR_TIMEOUT_SECONDS: int = 60
    TESSERACT_CMD: str = os.getenv("TESSERACT_CMD", "tesseract")
    DEFAULT_OCR_ENGINE: str = "tesseract"
    
    # Storage & Persistence
    STORAGE_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "storage_data")
    
    # Financial Reconciliation & Completeness Thresholds
    BALANCE_TOLERANCE: float = 0.01
    RECONCILIATION_TOLERANCE_STR: str = "0.01"
    SUSPICIOUS_ROW_TOLERANCE_STR: str = "0.05"
    COMPLETENESS_MIN_RATIO_STR: str = "0.98"
    MAX_SUSPICIOUS_ROWS: int = 2
    MAX_UNRESOLVED_GAPS: int = 0


settings = Settings()

