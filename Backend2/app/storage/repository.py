import os
import json
from typing import Optional, Dict, Any
from ..core.config import settings
from ..models.document import DocumentMetadata


class StatementRepository:
    _memory_store: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def _get_storage_path(cls) -> str:
        os.makedirs(settings.STORAGE_DIR, exist_ok=True)
        return settings.STORAGE_DIR

    @classmethod
    def save_statement_result(cls, request_id: str, metadata: DocumentMetadata, result: Dict[str, Any]) -> None:
        cls._memory_store[request_id] = {
            "metadata": metadata.model_dump(),
            "result": result,
        }

        # Also write to local storage JSON file for persistence
        try:
            file_path = os.path.join(cls._get_storage_path(), f"{request_id}.json")
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(cls._memory_store[request_id], f, default=str)
        except Exception:
            pass

    @classmethod
    def get_statement_result(cls, request_id: str) -> Optional[Dict[str, Any]]:
        if request_id in cls._memory_store:
            return cls._memory_store[request_id]

        file_path = os.path.join(cls._get_storage_path(), f"{request_id}.json")
        if os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    cls._memory_store[request_id] = data
                    return data
            except Exception:
                return None
        return None
