import logging
import json
import re
import sys
from datetime import datetime, timezone
from typing import Any, Dict


def mask_sensitive_text(text: str) -> str:
    """Masks PAN, Aadhaar, Account Numbers, and Phone Numbers in log messages."""
    if not isinstance(text, str):
        return str(text)
    
    # Mask 10-18 digit account numbers
    text = re.sub(r'\b(\d{2,4})\d{4,10}(\d{4})\b', r'\1******\2', text)
    # Mask Indian PAN: 5 letters, 4 digits, 1 letter
    text = re.sub(r'\b([A-Z]{5})\d{4}([A-Z])\b', r'\1****\2', text, flags=re.IGNORECASE)
    # Mask 12 digit Aadhaar
    text = re.sub(r'\b\d{4}\s?\d{4}\s?(\d{4})\b', r'XXXX-XXXX-\1', text)
    # Mask 10 digit phone
    text = re.sub(r'\b[6-9]\d{5}(\d{4})\b', r'XXXXXX\1', text)
    
    return text


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_obj: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": mask_sensitive_text(record.getMessage()),
        }
        
        # Attach custom audit fields
        for key in ["request_id", "document_id", "stage", "page", "bank", "duration_ms", "status"]:
            if hasattr(record, key):
                val = getattr(record, key)
                if isinstance(val, str):
                    val = mask_sensitive_text(val)
                log_obj[key] = val
                
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)
            
        return json.dumps(log_obj)


def setup_logger(name: str = "bank_analyzer") -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger


logger = setup_logger()
