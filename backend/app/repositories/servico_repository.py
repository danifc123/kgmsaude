from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Servico


class ServicoRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def listar_ativos(self) -> list[Servico]:
        """Serviços ativos ordenados por categoria e preço."""
        query = (
            select(Servico)
            .where(Servico.ativo.is_(True))
            .order_by(Servico.categoria.desc(), Servico.preco_centavos)
        )
        return list(self.db.scalars(query))

    def listar_por_ids(self, ids: list[str]) -> list[Servico]:
        """Serviços ativos com os ids informados."""
        query = select(Servico).where(Servico.id.in_(ids), Servico.ativo.is_(True))
        return list(self.db.scalars(query))
