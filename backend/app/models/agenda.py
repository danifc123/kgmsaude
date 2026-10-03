from datetime import datetime, time

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class HorarioFuncionamento(Base):
    """Faixa de atendimento de um dia da semana (0 = segunda). Um dia pode ter várias."""

    __tablename__ = "horarios_funcionamento"

    id: Mapped[int] = mapped_column(primary_key=True)
    abre_as: Mapped[time]
    dia_semana: Mapped[int]
    fecha_as: Mapped[time]


class Bloqueio(Base):
    """Período em que não há atendimento (folga, feriado, compromisso)."""

    __tablename__ = "bloqueios"

    id: Mapped[int] = mapped_column(primary_key=True)
    fim: Mapped[datetime]
    inicio: Mapped[datetime]
    motivo: Mapped[str | None] = mapped_column(String(120))
