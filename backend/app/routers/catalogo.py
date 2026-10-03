from typing import Annotated

from fastapi import APIRouter, Depends

from app.dependencies import get_catalogo_service
from app.schemas.servico import ServicoRead
from app.services.catalogo_service import CatalogoService

router = APIRouter(prefix="/servicos", tags=["catálogo"])


@router.get("", response_model=list[ServicoRead])
def listar_servicos(catalogo: Annotated[CatalogoService, Depends(get_catalogo_service)]):
    """Catálogo de serviços ativos."""
    return catalogo.listar()
