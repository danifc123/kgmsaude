import re
import unicodedata

from sqlalchemy.orm import Session

from app.exceptions import NaoEncontradoError, RegraDeNegocioError
from app.models import Servico
from app.repositories.servico_repository import ServicoRepository
from app.schemas.servico import ServicoCreate, ServicoUpdate


def gerar_slug(texto: str) -> str:
    """Id a partir do nome: Massagem a domicílio → massagem-a-domicilio."""
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", sem_acento.lower()).strip("-")[:60] or "servico"


class CatalogoService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.servicos = ServicoRepository(db)

    # region Site

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

    # endregion

    # region Painel

    def atualizar(self, servico_id: str, dados: ServicoUpdate) -> Servico:
        """
        Altera só os campos enviados. Agendamentos já feitos não mudam: eles guardam
        o nome, o preço e a duração do momento da reserva.
        """
        servico = self.servicos.buscar(servico_id)
        if servico is None:
            raise NaoEncontradoError("Serviço não encontrado.")
        for campo, valor in dados.model_dump(exclude_unset=True).items():
            setattr(servico, campo, valor.strip() if isinstance(valor, str) else valor)
        self.db.commit()
        return servico

    def criar(self, dados: ServicoCreate) -> Servico:
        """Cria um serviço com id derivado do nome (com sufixo se já existir)."""
        base = gerar_slug(dados.nome)
        servico_id, sufixo = base, 2
        while self.servicos.buscar(servico_id):
            servico_id, sufixo = f"{base}-{sufixo}", sufixo + 1

        servico = self.servicos.salvar(
            Servico(id=servico_id, ativo=True, **{**dados.model_dump(), "nome": dados.nome.strip()})
        )
        self.db.commit()
        return servico

    def listar_todos(self) -> list[Servico]:
        return self.servicos.listar_todos()

    # endregion
