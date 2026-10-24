from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from app.models import Agendamento, Pagamento, StatusAgendamento, StatusPagamento
from app.repositories.agendamento_repository import AgendamentoRepository
from app.repositories.pagamento_repository import PagamentoRepository

STATUS_QUE_FATURAM = (StatusAgendamento.CONFIRMADO, StatusAgendamento.CONCLUIDO)


@dataclass
class ResumoFinanceiro:
    """Números do mês. Valores em centavos, brutos (a taxa do Mercado Pago sai no extrato dele)."""

    mes: date
    a_receber_centavos: int = 0
    atendimentos_confirmados: int = 0
    devolucoes: list[Pagamento] = field(default_factory=list)
    faturamento_centavos: int = 0
    pagamentos: list[Pagamento] = field(default_factory=list)
    por_dia: list[tuple[date, int]] = field(default_factory=list)
    recebido_pix_centavos: int = 0
    sinais_manuais_centavos: int = 0


def _pix_aprovado(agendamento: Agendamento) -> bool:
    return bool(agendamento.pagamento and agendamento.pagamento.status == StatusPagamento.APROVADO)


class FinanceiroService:
    def __init__(self, db: Session, agora: Callable[[], datetime]) -> None:
        self.agendamentos = AgendamentoRepository(db)
        self.agora = agora
        self.pagamentos = PagamentoRepository(db)

    def resumir_mes(self, mes: date | None) -> ResumoFinanceiro:
        """
        - recebido pelo site: Pix aprovados com data de pagamento no mês;
        - faturamento: valor total dos atendimentos confirmados/concluídos marcados no mês;
        - a receber: o restante (total - sinal) dos confirmados que ainda vão acontecer;
        - sinais manuais: sinais confirmados no painel sem Pix automático;
        - devoluções: Pix pagos de agendamentos expirados/cancelados (qualquer mês).
        """
        primeiro_dia = (mes or self.agora().date()).replace(day=1)
        proximo_mes = (primeiro_dia + timedelta(days=32)).replace(day=1)
        inicio = datetime.combine(primeiro_dia, time.min)
        fim = datetime.combine(proximo_mes, time.min)

        pagamentos = self.pagamentos.listar_aprovados_entre(inicio, fim)
        faturados = [
            a for a in self.agendamentos.listar_entre(inicio, fim) if a.status in STATUS_QUE_FATURAM
        ]

        por_dia = {
            primeiro_dia + timedelta(days=i): 0 for i in range((proximo_mes - primeiro_dia).days)
        }
        for pagamento in pagamentos:
            por_dia[pagamento.pago_em.date()] += pagamento.valor_centavos

        return ResumoFinanceiro(
            mes=primeiro_dia,
            a_receber_centavos=sum(
                a.total_centavos - a.sinal_centavos
                for a in faturados
                if a.status == StatusAgendamento.CONFIRMADO
            ),
            atendimentos_confirmados=len(faturados),
            devolucoes=self.pagamentos.listar_para_devolver(),
            faturamento_centavos=sum(a.total_centavos for a in faturados),
            pagamentos=pagamentos,
            por_dia=list(por_dia.items()),
            recebido_pix_centavos=sum(p.valor_centavos for p in pagamentos),
            sinais_manuais_centavos=sum(
                a.sinal_centavos for a in faturados if not _pix_aprovado(a)
            ),
        )
