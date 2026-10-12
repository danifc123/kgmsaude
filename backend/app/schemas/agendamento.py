import re
from datetime import datetime

from pydantic import Field, field_validator

from app.models import StatusAgendamento
from app.schemas.base import CamelModel
from app.schemas.pagamento import PagamentoRead

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class AgendamentoCreate(CamelModel):
    cliente_email: str | None = Field(default=None, max_length=120)
    cliente_nome: str = Field(min_length=2, max_length=100)
    cliente_telefone: str = Field(min_length=10, max_length=20)
    endereco: str | None = Field(default=None, max_length=200)
    inicio: datetime
    observacao: str | None = Field(default=None, max_length=300)
    servico_ids: list[str] = Field(min_length=1, max_length=10)

    @field_validator("cliente_email")
    @classmethod
    def _validar_email(cls, valor: str | None) -> str | None:
        valor = (valor or "").strip().lower()
        if not valor:
            return None
        if not _EMAIL.match(valor):
            raise ValueError("E-mail inválido.")
        return valor

    @field_validator("cliente_telefone")
    @classmethod
    def _somente_digitos(cls, valor: str) -> str:
        digitos = "".join(c for c in valor if c.isdigit())
        if not 10 <= len(digitos) <= 13:
            raise ValueError("Telefone inválido.")
        return digitos

    @field_validator("inicio")
    @classmethod
    def _sem_fuso(cls, valor: datetime) -> datetime:
        return valor.replace(tzinfo=None, second=0, microsecond=0)


class AgendamentoItemRead(CamelModel):
    duracao_minutos: int
    nome: str
    preco_centavos: int
    servico_id: str


class AgendamentoPublicoRead(CamelModel):
    """O que a cliente vê no checkout — sem dados de contato."""

    id: str
    codigo: str
    expira_em: datetime | None
    fim: datetime
    inicio: datetime
    itens: list[AgendamentoItemRead]
    pagamento: PagamentoRead | None
    sinal_centavos: int
    status: StatusAgendamento
    total_centavos: int


class AgendamentoRead(AgendamentoPublicoRead):
    """Visão completa, para o painel."""

    cliente_email: str | None
    cliente_nome: str
    cliente_telefone: str
    criado_em: datetime
    endereco: str | None
    observacao: str | None


class AgendamentoStatusUpdate(CamelModel):
    status: StatusAgendamento
