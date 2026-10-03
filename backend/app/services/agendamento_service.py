import secrets
from collections.abc import Callable
from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from app.config import get_settings
from app.exceptions import ConflitoError, NaoEncontradoError, RegraDeNegocioError
from app.models import Agendamento, AgendamentoItem, StatusAgendamento
from app.repositories.agendamento_repository import AgendamentoRepository
from app.schemas.agendamento import AgendamentoCreate
from app.services.agenda_service import AgendaService
from app.services.catalogo_service import CatalogoService

# Para onde cada status pode ir. CONCLUIDO e CANCELADO são finais.
TRANSICOES_PERMITIDAS: dict[StatusAgendamento, set[StatusAgendamento]] = {
    StatusAgendamento.PENDENTE: {StatusAgendamento.CONFIRMADO, StatusAgendamento.CANCELADO},
    StatusAgendamento.CONFIRMADO: {StatusAgendamento.CONCLUIDO, StatusAgendamento.CANCELADO},
    StatusAgendamento.CONCLUIDO: set(),
    StatusAgendamento.CANCELADO: set(),
}


def calcular_sinal(total_centavos: int, percentual: int) -> int:
    """Sinal em centavos, arredondado para cima (R$ 125,01 a 50% → R$ 62,51)."""
    return -(-total_centavos * percentual // 100)


def _texto_ou_none(valor: str | None) -> str | None:
    return (valor or "").strip() or None


class AgendamentoService:
    def __init__(self, db: Session, agora: Callable[[], datetime]) -> None:
        self.agenda = AgendaService(db, agora)
        self.agendamentos = AgendamentoRepository(db)
        self.agora = agora
        self.catalogo = CatalogoService(db)
        self.db = db
        self.settings = get_settings()

    def atualizar_status(self, agendamento_id: str, novo: StatusAgendamento) -> Agendamento:
        """Muda o status respeitando TRANSICOES_PERMITIDAS. Retorna o agendamento salvo."""
        agendamento = self.agendamentos.buscar(agendamento_id)
        if agendamento is None:
            raise NaoEncontradoError("Agendamento não encontrado.")
        if novo not in TRANSICOES_PERMITIDAS[agendamento.status]:
            raise RegraDeNegocioError(f"Não é possível mudar de {agendamento.status} para {novo}.")

        agendamento.status = novo
        self.db.commit()
        return agendamento

    def criar(self, dados: AgendamentoCreate) -> Agendamento:
        """
        Reserva o horário como PENDENTE — ele ocupa a agenda até ser confirmado ou
        cancelado no painel. Preço e duração vêm do banco, nunca do cliente.
        """
        servicos = self.catalogo.buscar_servicos(dados.servico_ids)
        duracao = sum(s.duracao_minutos for s in servicos)
        total = sum(s.preco_centavos for s in servicos)

        if any(s.exige_endereco for s in servicos) and not _texto_ou_none(dados.endereco):
            raise RegraDeNegocioError("Informe o endereço para o atendimento a domicílio.")
        if not self.agenda.horario_esta_livre(dados.inicio, duracao):
            raise ConflitoError("Esse horário acabou de ficar indisponível. Escolha outro.")

        agendamento = Agendamento(
            cliente_nome=dados.cliente_nome.strip(),
            cliente_telefone=dados.cliente_telefone,
            codigo=self._gerar_codigo(),
            criado_em=self.agora(),
            endereco=_texto_ou_none(dados.endereco),
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
        self.db.commit()
        return agendamento

    def listar(self, data: date | None) -> list[Agendamento]:
        """Agendamentos de um dia; sem data, todos a partir de hoje."""
        if data is None:
            inicio = datetime.combine(self.agora().date(), time.min)
            return self.agendamentos.listar_entre(inicio, inicio + timedelta(days=365))
        inicio = datetime.combine(data, time.min)
        return self.agendamentos.listar_entre(inicio, inicio + timedelta(days=1))

    def _gerar_codigo(self) -> str:
        """Código curto para a cliente citar no WhatsApp, ex: KG-7F3A."""
        while True:
            codigo = f"KG-{secrets.token_hex(2).upper()}"
            if not self.agendamentos.codigo_existe(codigo):
                return codigo
