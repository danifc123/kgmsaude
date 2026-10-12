from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Pagamento


class PagamentoRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def buscar_por_provedor_id(self, provedor_pagamento_id: str) -> Pagamento | None:
        query = select(Pagamento).where(Pagamento.provedor_pagamento_id == provedor_pagamento_id)
        return self.db.scalar(query)

    def salvar(self, pagamento: Pagamento) -> Pagamento:
        self.db.add(pagamento)
        self.db.flush()
        return pagamento
