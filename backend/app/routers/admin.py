from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.dependencies import (
    get_agenda_service,
    get_agendamento_service,
    get_catalogo_service,
    get_current_admin,
    get_financeiro_service,
)
from app.models import Pagamento
from app.schemas.agenda import BloqueioCreate, BloqueioRead, ExpedienteRead, ExpedienteUpdate
from app.schemas.agendamento import AgendamentoRead, AgendamentoStatusUpdate
from app.schemas.financeiro import FinanceiroRead, PagamentoRecebidoRead, ValorDiaRead
from app.schemas.servico import ServicoAdminRead, ServicoCreate, ServicoUpdate
from app.services.agenda_service import AgendaService
from app.services.agendamento_service import AgendamentoService
from app.services.catalogo_service import CatalogoService
from app.services.financeiro_service import FinanceiroService

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(get_current_admin)])

AgendaDep = Annotated[AgendaService, Depends(get_agenda_service)]
AgendamentoDep = Annotated[AgendamentoService, Depends(get_agendamento_service)]
CatalogoDep = Annotated[CatalogoService, Depends(get_catalogo_service)]
FinanceiroDep = Annotated[FinanceiroService, Depends(get_financeiro_service)]


# region Agendamentos


@router.get("/agendamentos", response_model=list[AgendamentoRead])
def listar_agendamentos(
    agendamentos: AgendamentoDep,
    data: date | None = None,
    inicio: date | None = None,
    fim: date | None = None,
):
    """
    ?data=  → um dia · ?inicio=&fim= → período (datas inclusivas) ·
    sem parâmetros → todos a partir de hoje.
    """
    if data:
        return agendamentos.listar(data)
    return agendamentos.listar(inicio, fim)


@router.patch("/agendamentos/{agendamento_id}", response_model=AgendamentoRead)
def atualizar_status_agendamento(
    agendamento_id: str, dados: AgendamentoStatusUpdate, agendamentos: AgendamentoDep
):
    """Confirma, conclui ou cancela um agendamento."""
    return agendamentos.atualizar_status(agendamento_id, dados.status)


# endregion

# region Agenda (bloqueios e expediente)


@router.get("/bloqueios", response_model=list[BloqueioRead])
def listar_bloqueios(agenda: AgendaDep, inicio: date | None = None, fim: date | None = None):
    """Bloqueios do período informado; sem período, os que ainda não terminaram."""
    return agenda.listar_bloqueios(inicio, fim)


@router.post("/bloqueios", response_model=BloqueioRead, status_code=status.HTTP_201_CREATED)
def criar_bloqueio(dados: BloqueioCreate, agenda: AgendaDep):
    return agenda.criar_bloqueio(
        dados.inicio.replace(tzinfo=None), dados.fim.replace(tzinfo=None), dados.motivo
    )


@router.delete("/bloqueios/{bloqueio_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_bloqueio(bloqueio_id: int, agenda: AgendaDep) -> None:
    agenda.remover_bloqueio(bloqueio_id)


@router.get("/expediente", response_model=list[ExpedienteRead])
def listar_expediente(agenda: AgendaDep):
    """Faixas de atendimento de cada dia da semana (usado no calendário do painel)."""
    return agenda.listar_expediente()


@router.put("/expediente", response_model=list[ExpedienteRead])
def atualizar_expediente(dados: ExpedienteUpdate, agenda: AgendaDep):
    """Substitui o horário de atendimento da semana inteira."""
    return agenda.atualizar_expediente(
        [(f.dia_semana, f.abre_as, f.fecha_as) for f in dados.faixas]
    )


# endregion

# region Serviços


@router.get("/servicos", response_model=list[ServicoAdminRead])
def listar_servicos(catalogo: CatalogoDep):
    """Todos os serviços, inclusive os desativados."""
    return catalogo.listar_todos()


@router.post("/servicos", response_model=ServicoAdminRead, status_code=status.HTTP_201_CREATED)
def criar_servico(dados: ServicoCreate, catalogo: CatalogoDep):
    return catalogo.criar(dados)


@router.patch("/servicos/{servico_id}", response_model=ServicoAdminRead)
def atualizar_servico(servico_id: str, dados: ServicoUpdate, catalogo: CatalogoDep):
    """Muda preço, duração, nome, categoria ou ativa/desativa o serviço."""
    return catalogo.atualizar(servico_id, dados)


# endregion

# region Financeiro


def _pagamento_recebido(pagamento: Pagamento) -> PagamentoRecebidoRead:
    agendamento = pagamento.agendamento
    return PagamentoRecebidoRead(
        agendamento_codigo=agendamento.codigo,
        agendamento_id=agendamento.id,
        agendamento_status=agendamento.status,
        cliente_nome=agendamento.cliente_nome,
        pago_em=pagamento.pago_em,
        valor_centavos=pagamento.valor_centavos,
    )


@router.get("/financeiro", response_model=FinanceiroRead)
def obter_financeiro(financeiro: FinanceiroDep, mes: date | None = None):
    """Resumo do mês de `mes` (qualquer dia do mês; padrão: mês atual)."""
    resumo = financeiro.resumir_mes(mes)
    return FinanceiroRead(
        a_receber_centavos=resumo.a_receber_centavos,
        atendimentos_confirmados=resumo.atendimentos_confirmados,
        devolucoes=[_pagamento_recebido(p) for p in resumo.devolucoes],
        faturamento_centavos=resumo.faturamento_centavos,
        mes=resumo.mes,
        pagamentos=[_pagamento_recebido(p) for p in resumo.pagamentos],
        por_dia=[ValorDiaRead(data=d, valor_centavos=v) for d, v in resumo.por_dia],
        recebido_pix_centavos=resumo.recebido_pix_centavos,
        sinais_manuais_centavos=resumo.sinais_manuais_centavos,
    )


# endregion
