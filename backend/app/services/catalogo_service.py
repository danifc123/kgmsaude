from sqlalchemy.orm import Session

from app.exceptions import RegraDeNegocioError
from app.models import Servico
from app.repositories.servico_repository import ServicoRepository


class CatalogoService:
    def __init__(self, db: Session) -> None:
        self.servicos = ServicoRepository(db)

    def buscar_servicos(self, ids: list[str]) -> list[Servico]:
        """Retorna os serviços pedidos, na ordem informada. Falha se algum não existir."""
        ids_unicos = list(dict.fromkeys(ids))
        encontrados = {s.id: s for s in self.servicos.listar_por_ids(ids_unicos)}
        faltando = [i for i in ids_unicos if i not in encontrados]
        if faltando:
            raise RegraDeNegocioError(f"Serviço indisponível: {', '.join(faltando)}.")
        return [encontrados[i] for i in ids_unicos]

    def listar(self) -> list[Servico]:
        return self.servicos.listar_ativos()
