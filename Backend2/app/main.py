import contextlib
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .core.config import settings
from .core.logging import logger
from .api.routes import health, statements


from .services.ocr.discovery import check_ocr_engine


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"🚀 {settings.APP_NAME} v{settings.APP_VERSION} initialized on {settings.HOST}:{settings.PORT}")
    
    # Startup OCR Discovery Check
    ocr_info = check_ocr_engine()
    if ocr_info["available"]:
        logger.info(
            f"OCR engine detected: {ocr_info['engine']} | Version: {ocr_info['version']} | Path: {ocr_info['executable_path']}"
        )
    else:
        logger.warning(
            "OCR engine unavailable. Scanned/image PDFs cannot be analyzed until Tesseract is installed/configured."
        )
        
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Enterprise Universal Bank Statement Analyzer Backend in Python FastAPI",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(health.router, prefix="/api/v1")
app.include_router(statements.router, prefix="/api/v1")
# Root prefix router for frontend backward compatibility
app.include_router(statements.router, prefix="/api")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server exception on {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An internal error occurred while processing the request.",
            },
        },
    )
