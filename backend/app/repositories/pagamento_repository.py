from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Agendamento, Pagamento, StatusAgendamento, StatusPagamento


class PagamentoRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def listar_aprovados_entre(self, inicio: datetime, fim: datetime) -> list[Pagamento]:
        """Pix pagos (pago_em) no intervalo [inicio, fim), do mais antigo ao mais novo."""
        query = (
            select(Pagamento)
            .where(
                Pagamento.status == StatusPagamento.APROVADO,
                Pagamento.pago_em >= inicio,
                Pagamento.pago_em < fim,
            )
            .order_by(Pagamento.pago_em)
        )
        return list(self.db.scalars(query))

    def listar_para_devolver(self) -> list[Pagamento]:
        """Pix pagos de agendamentos que não vão acontecer (expirados ou cancelados)."""
        query = (
            select(Pagamento)
            .join(Agendamento)
            .where(
                Pagamento.status == StatusPagamento.APROVADO,
                Agendamento.status.in_([StatusAgendamento.EXPIRADO, StatusAgendamento.CANCELADO]),
            )
            .order_by(Pagamento.pago_em)
        )
        return list(self.db.scalars(query))

    def buscar_por_provedor_id(self, provedor_pagamento_id: str) -> Pagamento | None:
        query = select(Pagamento).where(Pagamento.provedor_pagamento_id == provedor_pagamento_id)
        return self.db.scalar(query)

    def salvar(self, pagamento: Pagamento) -> Pagamento:
        self.db.add(pagamento)
        self.db.flush()
        return pagamento
