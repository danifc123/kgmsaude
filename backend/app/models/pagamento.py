from datetime import datetime
from enum import StrEnum

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.agendamento import Agendamento


class StatusPagamento(StrEnum):
    PENDENTE = "PENDENTE"
    APROVADO = "APROVADO"
    CANCELADO = "CANCELADO"


class Pagamento(Base):
    """Cobrança Pix do sinal de um agendamento (uma por agendamento)."""

    __tablename__ = "pagamentos"

    id: Mapped[int] = mapped_column(primary_key=True)
    agendamento_id: Mapped[str] = mapped_column(ForeignKey("agendamentos.id"), unique=True)
    criado_em: Mapped[datetime]
    expira_em: Mapped[datetime]
    pago_em: Mapped[datetime | None]
    pix_copia_cola: Mapped[str] = mapped_column(Text)
    pix_qr_base64: Mapped[str | None] = mapped_column(Text)
    provedor: Mapped[str] = mapped_column(String(20))
    provedor_pagamento_id: Mapped[str] = mapped_column(String(64), unique=True)
    status: Mapped[StatusPagamento] = mapped_column(String(15), default=StatusPagamento.PENDENTE)
    valor_centavos: Mapped[int]

    agendamento: Mapped[Agendamento] = relationship(back_populates="pagamento")
