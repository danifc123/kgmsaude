from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.dependencies import get_agenda_service, get_agendamento_service, get_current_admin
from app.schemas.agenda import BloqueioCreate, BloqueioRead
from app.schemas.agendamento import AgendamentoRead, AgendamentoStatusUpdate
from app.services.agenda_service import AgendaService
from app.services.agendamento_service import AgendamentoService

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(get_current_admin)])

AgendaDep = Annotated[AgendaService, Depends(get_agenda_service)]
AgendamentoDep = Annotated[AgendamentoService, Depends(get_agendamento_service)]


# region Agendamentos


@router.get("/agendamentos", response_model=list[AgendamentoRead])
def listar_agendamentos(agendamentos: AgendamentoDep, data: date | None = None):
    """Agendamentos do dia informado; sem data, todos a partir de hoje."""
    return agendamentos.listar(data)


@router.patch("/agendamentos/{agendamento_id}", response_model=AgendamentoRead)
def atualizar_status_agendamento(
    agendamento_id: str, dados: AgendamentoStatusUpdate, agendamentos: AgendamentoDep
):
    """Confirma, conclui ou cancela um agendamento."""
    return agendamentos.atualizar_status(agendamento_id, dados.status)


# endregion

# region Bloqueios


@router.get("/bloqueios", response_model=list[BloqueioRead])
def listar_bloqueios(agenda: AgendaDep):
    """Bloqueios que ainda não terminaram."""
    return agenda.listar_bloqueios_futuros()


@router.post("/bloqueios", response_model=BloqueioRead, status_code=status.HTTP_201_CREATED)
def criar_bloqueio(dados: BloqueioCreate, agenda: AgendaDep):
    return agenda.criar_bloqueio(
        dados.inicio.replace(tzinfo=None), dados.fim.replace(tzinfo=None), dados.motivo
    )


@router.delete("/bloqueios/{bloqueio_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_bloqueio(bloqueio_id: int, agenda: AgendaDep) -> None:
    agenda.remover_bloqueio(bloqueio_id)


# endregion
