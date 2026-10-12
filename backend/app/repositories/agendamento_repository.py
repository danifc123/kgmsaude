from datetime import datetime

from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session

from app.models import Agendamento, StatusAgendamento


def _ocupa_horario(agora: datetime):
    """Confirmado sempre ocupa; pendente só enquanto o prazo do Pix não venceu."""
    return or_(
        Agendamento.status == StatusAgendamento.CONFIRMADO,
        (Agendamento.status == StatusAgendamento.PENDENTE)
        & or_(Agendamento.expira_em.is_(None), Agendamento.expira_em > agora),
    )


class AgendamentoRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def buscar(self, agendamento_id: str) -> Agendamento | None:
        return self.db.get(Agendamento, agendamento_id)

    def codigo_existe(self, codigo: str) -> bool:
        query = select(Agendamento.id).where(Agendamento.codigo == codigo)
        return self.db.scalar(query) is not None

    def expirar_vencidos(self, agora: datetime) -> None:
        """Marca como EXPIRADO os pendentes cujo prazo de pagamento já passou."""
        self.db.execute(
            update(Agendamento)
            .where(
                Agendamento.status == StatusAgendamento.PENDENTE,
                Agendamento.expira_em.is_not(None),
                Agendamento.expira_em <= agora,
            )
            .values(status=StatusAgendamento.EXPIRADO)
        )

    def listar_entre(self, inicio: datetime, fim: datetime) -> list[Agendamento]:
        """Todos os agendamentos que começam no intervalo [inicio, fim)."""
        query = (
            select(Agendamento)
            .where(Agendamento.inicio >= inicio, Agendamento.inicio < fim)
            .order_by(Agendamento.inicio)
        )
        return list(self.db.scalars(query))

    def listar_ocupando_entre(
        self, inicio: datetime, fim: datetime, agora: datetime, ignorar_id: str | None = None
    ) -> list[Agendamento]:
        """Agendamentos que seguram a agenda e encostam em [inicio, fim)."""
        query = select(Agendamento).where(
            _ocupa_horario(agora), Agendamento.inicio < fim, Agendamento.fim > inicio
        )
        if ignorar_id:
            query = query.where(Agendamento.id != ignorar_id)
        return list(self.db.scalars(query))

    def salvar(self, agendamento: Agendamento) -> Agendamento:
        self.db.add(agendamento)
        self.db.flush()
        return agendamento
