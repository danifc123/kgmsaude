from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Servico

_ORDEM = (Servico.categoria.desc(), Servico.preco_centavos, Servico.nome)


class ServicoRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def buscar(self, servico_id: str) -> Servico | None:
        return self.db.get(Servico, servico_id)

    def listar_ativos(self) -> list[Servico]:
        """Serviços ativos ordenados por categoria e preço."""
        return list(
            self.db.scalars(select(Servico).where(Servico.ativo.is_(True)).order_by(*_ORDEM))
        )

    def listar_por_ids(self, ids: list[str]) -> list[Servico]:
        """Serviços ativos com os ids informados."""
        query = select(Servico).where(Servico.id.in_(ids), Servico.ativo.is_(True))
        return list(self.db.scalars(query))

    def listar_todos(self) -> list[Servico]:
        """Todos os serviços, inclusive os desativados (para o painel)."""
        return list(self.db.scalars(select(Servico).order_by(*_ORDEM)))

    def salvar(self, servico: Servico) -> Servico:
        self.db.add(servico)
        self.db.flush()
        return servico
