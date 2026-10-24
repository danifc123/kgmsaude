from datetime import date, datetime

from app.models import StatusAgendamento
from app.schemas.base import CamelModel


class PagamentoRecebidoRead(CamelModel):
    """Um Pix pago, com o mínimo do agendamento para identificar a cliente."""

    agendamento_codigo: str
    agendamento_id: str
    agendamento_status: StatusAgendamento
    cliente_nome: str
    pago_em: datetime
    valor_centavos: int


class ValorDiaRead(CamelModel):
    data: date
    valor_centavos: int


class FinanceiroRead(CamelModel):
    a_receber_centavos: int
    atendimentos_confirmados: int
    devolucoes: list[PagamentoRecebidoRead]
    faturamento_centavos: int
    mes: date
    pagamentos: list[PagamentoRecebidoRead]
    por_dia: list[ValorDiaRead]
    recebido_pix_centavos: int
    sinais_manuais_centavos: int
