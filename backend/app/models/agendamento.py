import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class StatusAgendamento(StrEnum):
    PENDENTE = "PENDENTE"
    CONFIRMADO = "CONFIRMADO"
    CONCLUIDO = "CONCLUIDO"
    CANCELADO = "CANCELADO"


class Agendamento(Base):
    __tablename__ = "agendamentos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    cliente_nome: Mapped[str] = mapped_column(String(100))
    cliente_telefone: Mapped[str] = mapped_column(String(20))
    codigo: Mapped[str] = mapped_column(String(10), unique=True)
    criado_em: Mapped[datetime]
    endereco: Mapped[str | None] = mapped_column(String(200))
    fim: Mapped[datetime]
    inicio: Mapped[datetime] = mapped_column(index=True)
    observacao: Mapped[str | None] = mapped_column(String(300))
    sinal_centavos: Mapped[int]
    status: Mapped[StatusAgendamento] = mapped_column(
        String(15), default=StatusAgendamento.PENDENTE
    )
    total_centavos: Mapped[int]

    itens: Mapped[list["AgendamentoItem"]] = relationship(
        back_populates="agendamento", cascade="all, delete-orphan", lazy="selectin"
    )


class AgendamentoItem(Base):
    """Serviço do agendamento, com nome e preço copiados no momento da reserva."""

    __tablename__ = "agendamento_itens"

    id: Mapped[int] = mapped_column(primary_key=True)
    agendamento_id: Mapped[str] = mapped_column(ForeignKey("agendamentos.id"))
    duracao_minutos: Mapped[int]
    nome: Mapped[str] = mapped_column(String(80))
    preco_centavos: Mapped[int]
    servico_id: Mapped[str] = mapped_column(ForeignKey("servicos.id"))

    agendamento: Mapped[Agendamento] = relationship(back_populates="itens")
