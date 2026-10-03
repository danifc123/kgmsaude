from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.dependencies import get_agendamento_service
from app.schemas.agendamento import AgendamentoCreate, AgendamentoRead
from app.services.agendamento_service import AgendamentoService

router = APIRouter(prefix="/agendamentos", tags=["agendamentos"])


@router.post("", response_model=AgendamentoRead, status_code=status.HTTP_201_CREATED)
def criar_agendamento(
    dados: AgendamentoCreate,
    agendamentos: Annotated[AgendamentoService, Depends(get_agendamento_service)],
):
    """Reserva o horário. Fica PENDENTE até a Katiuschia confirmar o sinal no painel."""
    return agendamentos.criar(dados)
