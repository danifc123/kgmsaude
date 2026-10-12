import logging
import secrets
from collections.abc import Callable
from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from app.config import get_settings
from app.exceptions import ConflitoError, GatewayError, NaoEncontradoError, RegraDeNegocioError
from app.gateways import PaymentGateway
from app.models import Agendamento, AgendamentoItem, StatusAgendamento, StatusPagamento
from app.repositories.agendamento_repository import AgendamentoRepository
from app.schemas.agendamento import AgendamentoCreate
from app.services.agenda_service import AgendaService
from app.services.catalogo_service import CatalogoService
from app.services.pagamento_service import PagamentoService

logger = logging.getLogger(__name__)

# Para onde cada status pode ir pelo painel. CONCLUIDO, CANCELADO e EXPIRADO são finais.
TRANSICOES_PERMITIDAS: dict[StatusAgendamento, set[StatusAgendamento]] = {
    StatusAgendamento.PENDENTE: {StatusAgendamento.CONFIRMADO, StatusAgendamento.CANCELADO},
    StatusAgendamento.CONFIRMADO: {StatusAgendamento.CONCLUIDO, StatusAgendamento.CANCELADO},
    StatusAgendamento.CONCLUIDO: set(),
    StatusAgendamento.CANCELADO: set(),
    StatusAgendamento.EXPIRADO: set(),
}


def calcular_sinal(total_centavos: int, percentual: int) -> int:
    """Sinal em centavos, arredondado para cima (R$ 125,01 a 50% → R$ 62,51)."""
    return -(-total_centavos * percentual // 100)


def _texto_ou_none(valor: str | None) -> str | None:
    return (valor or "").strip() or None


class AgendamentoService:
    def __init__(
        self, db: Session, agora: Callable[[], datetime], gateway: PaymentGateway | None
    ) -> None:
        self.agenda = AgendaService(db, agora)
        self.agendamentos = AgendamentoRepository(db)
        self.agora = agora
        self.catalogo = CatalogoService(db)
        self.db = db
        self.pagamentos = PagamentoService(db, gateway, agora) if gateway else None
        self.settings = get_settings()

    def atualizar_status(self, agendamento_id: str, novo: StatusAgendamento) -> Agendamento:
        """Muda o status respeitando TRANSICOES_PERMITIDAS. Retorna o agendamento salvo."""
        agendamento = self._buscar(agendamento_id)
        if novo not in TRANSICOES_PERMITIDAS[agendamento.status]:
            raise RegraDeNegocioError(f"Não é possível mudar de {agendamento.status} para {novo}.")

        agendamento.status = novo
        self.db.commit()
        return agendamento

    def buscar_para_cliente(self, agendamento_id: str) -> Agendamento:
        """
        Usado no polling do checkout. Se o Pix ainda está pendente, pergunta ao provedor —
        assim a confirmação chega mesmo sem webhook (ex: rodando local).
        """
        self._expirar_vencidos()
        agendamento = self._buscar(agendamento_id)
        pagamento = agendamento.pagamento
        if self.pagamentos and pagamento and pagamento.status == StatusPagamento.PENDENTE:
            try:
                self.pagamentos.sincronizar(pagamento)
            except GatewayError:
                logger.warning("Falha ao sincronizar pagamento de %s", agendamento.codigo)
        return agendamento

    def criar(self, dados: AgendamentoCreate) -> Agendamento:
        """
        Reserva o horário como PENDENTE. Com Pix automático, gera a cobrança e segura o
        horário por PAGAMENTO_EXPIRA_MINUTOS; no modo manual, segura até ela confirmar
        ou cancelar no painel. Preço e duração vêm do banco, nunca do cliente.
        """
        servicos = self.catalogo.buscar_servicos(dados.servico_ids)
        duracao = sum(s.duracao_minutos for s in servicos)
        total = sum(s.preco_centavos for s in servicos)

        if any(s.exige_endereco for s in servicos) and not _texto_ou_none(dados.endereco):
            raise RegraDeNegocioError("Informe o endereço para o atendimento a domicílio.")
        if self.pagamentos and not dados.cliente_email:
            raise RegraDeNegocioError("Informe seu e-mail para gerar o Pix.")
        if not self.agenda.horario_esta_livre(dados.inicio, duracao):
            raise ConflitoError("Esse horário acabou de ficar indisponível. Escolha outro.")

        agora = self.agora()
        agendamento = Agendamento(
            cliente_email=dados.cliente_email,
            cliente_nome=dados.cliente_nome.strip(),
            cliente_telefone=dados.cliente_telefone,
            codigo=self._gerar_codigo(),
            criado_em=agora,
            endereco=_texto_ou_none(dados.endereco),
            expira_em=(
                agora + timedelta(minutes=self.settings.pagamento_expira_minutos)
                if self.pagamentos
                else None
            ),
            fim=dados.inicio + timedelta(minutes=duracao),
            inicio=dados.inicio,
            itens=[
                AgendamentoItem(
                    duracao_minutos=s.duracao_minutos,
                    nome=s.nome,
                    preco_centavos=s.preco_centavos,
                    servico_id=s.id,
                )
                for s in servicos
            ],
            observacao=_texto_ou_none(dados.observacao),
            sinal_centavos=calcular_sinal(total, self.settings.sinal_percentual),
            status=StatusAgendamento.PENDENTE,
            total_centavos=total,
        )
        self.agendamentos.salvar(agendamento)

        if self.pagamentos:
            try:
                self.pagamentos.criar_cobranca(agendamento)
            except GatewayError:
                self.db.rollback()
                raise

        self.db.commit()
        return agendamento

    def listar(self, data: date | None) -> list[Agendamento]:
        """Agendamentos de um dia; sem data, todos a partir de hoje."""
        self._expirar_vencidos()
        if data is None:
            inicio = datetime.combine(self.agora().date(), time.min)
            return self.agendamentos.listar_entre(inicio, inicio + timedelta(days=365))
        inicio = datetime.combine(data, time.min)
        return self.agendamentos.listar_entre(inicio, inicio + timedelta(days=1))

    def _buscar(self, agendamento_id: str) -> Agendamento:
        agendamento = self.agendamentos.buscar(agendamento_id)
        if agendamento is None:
            raise NaoEncontradoError("Agendamento não encontrado.")
        return agendamento

    def _expirar_vencidos(self) -> None:
        self.agendamentos.expirar_vencidos(self.agora())
        self.db.commit()

    def _gerar_codigo(self) -> str:
        """Código curto para a cliente citar no WhatsApp, ex: KG-7F3A."""
        while True:
            codigo = f"KG-{secrets.token_hex(2).upper()}"
            if not self.agendamentos.codigo_existe(codigo):
                return codigo
