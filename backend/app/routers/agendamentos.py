from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.dependencies import get_agendamento_service
from app.rate_limit import limitar_agendamentos
from app.schemas.agendamento import AgendamentoCreate, AgendamentoPublicoRead
from app.services.agendamento_service import AgendamentoService

router = APIRouter(prefix="/agendamentos", tags=["agendamentos"])

AgendamentoDep = Annotated[AgendamentoService, Depends(get_agendamento_service)]


@router.post(
    "",
    response_model=AgendamentoPublicoRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(limitar_agendamentos)],
)
def criar_agendamento(dados: AgendamentoCreate, agendamentos: AgendamentoDep):
    """Reserva o horário e, com Pix automático, já devolve o QR code do sinal."""
    return agendamentos.criar(dados)


@router.get("/{agendamento_id}", response_model=AgendamentoPublicoRead)
def buscar_agendamento(agendamento_id: str, agendamentos: AgendamentoDep):
    """Status do agendamento e do Pix — consultado pelo checkout a cada poucos segundos."""
    return agendamentos.buscar_para_cliente(agendamento_id)
