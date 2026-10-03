from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Bloqueio, HorarioFuncionamento


class AgendaRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def buscar_bloqueio(self, bloqueio_id: int) -> Bloqueio | None:
        return self.db.get(Bloqueio, bloqueio_id)

    def listar_bloqueios_entre(self, inicio: datetime, fim: datetime) -> list[Bloqueio]:
        """Bloqueios que encostam no intervalo [inicio, fim)."""
        query = (
            select(Bloqueio)
            .where(Bloqueio.inicio < fim, Bloqueio.fim > inicio)
            .order_by(Bloqueio.inicio)
        )
        return list(self.db.scalars(query))

    def listar_bloqueios_a_partir(self, inicio: datetime) -> list[Bloqueio]:
        query = select(Bloqueio).where(Bloqueio.fim > inicio).order_by(Bloqueio.inicio)
        return list(self.db.scalars(query))

    def listar_horarios_do_dia(self, dia_semana: int) -> list[HorarioFuncionamento]:
        query = (
            select(HorarioFuncionamento)
            .where(HorarioFuncionamento.dia_semana == dia_semana)
            .order_by(HorarioFuncionamento.abre_as)
        )
        return list(self.db.scalars(query))
