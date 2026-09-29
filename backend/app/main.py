from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import health


def create_app() -> FastAPI:
    """Monta a aplicação FastAPI com middlewares e routers."""
    settings = get_settings()
    application = FastAPI(title="KG Espaço Saúde API", version="0.1.0")

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )
    application.include_router(health.router, prefix="/api")
    return application


app = create_app()
