from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.dependencies import get_agenda_service, get_catalogo_service
from app.schemas.agenda import HorariosLivresRead
from app.services.agenda_service import AgendaService
from app.services.catalogo_service import CatalogoService

router = APIRouter(prefix="/agenda", tags=["agenda"])


@router.get("/horarios", response_model=HorariosLivresRead)
def listar_horarios_livres(
    agenda: Annotated[AgendaService, Depends(get_agenda_service)],
    catalogo: Annotated[CatalogoService, Depends(get_catalogo_service)],
    data: date,
    servicos: Annotated[str, Query(description="ids separados por vírgula")],
):
    """Horários livres no dia para o conjunto de serviços escolhido."""
    escolhidos = catalogo.buscar_servicos([s for s in servicos.split(",") if s])
    duracao = sum(s.duracao_minutos for s in escolhidos)
    livres = agenda.calcular_horarios_livres(data, duracao)
    return HorariosLivresRead(
        data=data,
        duracao_minutos=duracao,
        horarios=[h.strftime("%H:%M") for h in livres],
    )
