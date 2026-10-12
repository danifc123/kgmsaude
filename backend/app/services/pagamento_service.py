import logging
from collections.abc import Callable
from datetime import datetime

from sqlalchemy.orm import Session

from app.exceptions import NaoEncontradoError, RegraDeNegocioError
from app.gateways import FakeGateway, NovaCobrancaPix, PaymentGateway, SituacaoPagamento
from app.models import Agendamento, Pagamento, StatusAgendamento, StatusPagamento
from app.repositories.agendamento_repository import AgendamentoRepository
from app.repositories.pagamento_repository import PagamentoRepository
from app.services.agenda_service import AgendaService

logger = logging.getLogger(__name__)


class PagamentoService:
    def __init__(self, db: Session, gateway: PaymentGateway, agora: Callable[[], datetime]) -> None:
        self.agenda = AgendaService(db, agora)
        self.agendamentos = AgendamentoRepository(db)
        self.agora = agora
        self.db = db
        self.gateway = gateway
        self.pagamentos = PagamentoRepository(db)

    # region Cobrança

    def criar_cobranca(self, agendamento: Agendamento) -> Pagamento:
        """Gera o Pix do sinal no provedor e registra o pagamento pendente (sem commit)."""
        cobranca = self.gateway.criar_cobranca_pix(
            NovaCobrancaPix(
                agendamento_id=agendamento.id,
                descricao=f"Sinal {agendamento.codigo} - KG Espaço Saúde",
                expira_em=agendamento.expira_em,
                pagador_email=agendamento.cliente_email,
                pagador_nome=agendamento.cliente_nome.split()[0],
                valor_centavos=agendamento.sinal_centavos,
            )
        )
        return self.pagamentos.salvar(
            Pagamento(
                agendamento_id=agendamento.id,
                criado_em=self.agora(),
                expira_em=agendamento.expira_em,
                pix_copia_cola=cobranca.copia_cola,
                pix_qr_base64=cobranca.qr_base64,
                provedor=self.gateway.nome,
                provedor_pagamento_id=cobranca.provedor_pagamento_id,
                status=StatusPagamento.PENDENTE,
                valor_centavos=agendamento.sinal_centavos,
            )
        )

    # endregion

    # region Confirmação

    def aprovar_simulado(self, agendamento_id: str) -> None:
        """Só no modo fake: marca o Pix simulado como pago e processa como um webhook."""
        if not isinstance(self.gateway, FakeGateway):
            raise RegraDeNegocioError("Disponível apenas com o pagamento simulado.")
        agendamento = self.agendamentos.buscar(agendamento_id)
        if agendamento is None or agendamento.pagamento is None:
            raise NaoEncontradoError("Agendamento sem cobrança Pix.")
        self.gateway.aprovar(agendamento.pagamento.provedor_pagamento_id)
        self.sincronizar(agendamento.pagamento)

    def processar_notificacao(self, provedor_pagamento_id: str) -> None:
        """Webhook: ignora ids desconhecidos e pagamentos já aprovados (idempotente)."""
        pagamento = self.pagamentos.buscar_por_provedor_id(provedor_pagamento_id)
        if pagamento is None:
            logger.info("Notificação de pagamento desconhecido: %s", provedor_pagamento_id)
            return
        self.sincronizar(pagamento)

    def sincronizar(self, pagamento: Pagamento) -> None:
        """Consulta o provedor (fonte da verdade) e aplica o resultado no agendamento."""
        if pagamento.status != StatusPagamento.PENDENTE:
            return
        situacao = self.gateway.consultar_pagamento(pagamento.provedor_pagamento_id)
        self._aplicar(pagamento, situacao)
        self.db.commit()

    def _aplicar(self, pagamento: Pagamento, situacao: SituacaoPagamento) -> None:
        """
        Aprovado: confirma o agendamento — inclusive se o Pix caiu depois do prazo, desde
        que ninguém tenha ocupado o horário. Se ocupou, fica EXPIRADO com o sinal pago e
        o painel avisa que precisa devolver. Cancelado/recusado: libera o horário.
        """
        agendamento = pagamento.agendamento

        if situacao.status == StatusPagamento.CANCELADO:
            pagamento.status = StatusPagamento.CANCELADO
            if agendamento.status == StatusAgendamento.PENDENTE:
                agendamento.status = StatusAgendamento.EXPIRADO
            return

        if situacao.status != StatusPagamento.APROVADO:
            return
        if situacao.valor_centavos < pagamento.valor_centavos:
            logger.error(
                "Pagamento %s com valor menor que o sinal (%s < %s)",
                pagamento.provedor_pagamento_id,
                situacao.valor_centavos,
                pagamento.valor_centavos,
            )
            return

        pagamento.status = StatusPagamento.APROVADO
        pagamento.pago_em = self.agora()
        if agendamento.status not in (StatusAgendamento.PENDENTE, StatusAgendamento.EXPIRADO):
            return
        if self.agenda.intervalo_sem_conflito(agendamento.id, agendamento.inicio, agendamento.fim):
            agendamento.status = StatusAgendamento.CONFIRMADO
        else:
            agendamento.status = StatusAgendamento.EXPIRADO
            logger.warning("Sinal pago após o horário %s ser ocupado", agendamento.codigo)

    # endregion
