from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Agendamento, StatusAgendamento

STATUS_QUE_OCUPAM_HORARIO = (StatusAgendamento.PENDENTE, StatusAgendamento.CONFIRMADO)


class AgendamentoRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def buscar(self, agendamento_id: str) -> Agendamento | None:
        return self.db.get(Agendamento, agendamento_id)

    def codigo_existe(self, codigo: str) -> bool:
        query = select(Agendamento.id).where(Agendamento.codigo == codigo)
        return self.db.scalar(query) is not None

    def listar_entre(self, inicio: datetime, fim: datetime) -> list[Agendamento]:
        """Todos os agendamentos que começam no intervalo [inicio, fim)."""
        query = (
            select(Agendamento)
            .where(Agendamento.inicio >= inicio, Agendamento.inicio < fim)
            .order_by(Agendamento.inicio)
        )
        return list(self.db.scalars(query))

    def listar_ocupando_entre(self, inicio: datetime, fim: datetime) -> list[Agendamento]:
        """Agendamentos ativos (pendentes ou confirmados) que encostam em [inicio, fim)."""
        query = select(Agendamento).where(
            Agendamento.status.in_(STATUS_QUE_OCUPAM_HORARIO),
            Agendamento.inicio < fim,
            Agendamento.fim > inicio,
        )
        return list(self.db.scalars(query))

    def salvar(self, agendamento: Agendamento) -> Agendamento:
        self.db.add(agendamento)
        self.db.flush()
        return agendamento
