from fastapi import APIRouter
from ...core.config import settings
from ...services.ocr.discovery import check_ocr_engine

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check():
    ocr_status = check_ocr_engine()
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
        "ocr": ocr_status,
    }


@router.get("/health/ocr")
def health_ocr_check():
    ocr_status = check_ocr_engine()
    return {
        "ocr": ocr_status,
    }


@router.get("/version")
def version_check():
    return {
        "version": settings.APP_VERSION,
        "app": settings.APP_NAME,
    }
