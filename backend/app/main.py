from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import models  # noqa: F401  (registra as tabelas no Base)
from app.config import FRONTEND_DIR, get_settings
from app.database import Base, SessionLocal, engine
from app.exceptions import registrar_handlers
from app.routers import admin, agenda, agendamentos, auth, catalogo, health
from app.seed import popular_banco


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Cria as tabelas e os dados iniciais na subida da API."""
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        popular_banco(db)
    yield


def create_app() -> FastAPI:
    """Monta a aplicação: API em /api e, quando existir, o site estático em /."""
    settings = get_settings()
    application = FastAPI(title="KG Espaço Saúde API", version="0.2.0", lifespan=lifespan)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )
    registrar_handlers(application)

    for modulo in (health, catalogo, agenda, agendamentos, auth, admin):
        application.include_router(modulo.router, prefix="/api")

    if FRONTEND_DIR.is_dir():
        application.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
    return application


app = create_app()
