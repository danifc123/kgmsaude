from typing import Literal

from pydantic import Field

from app.schemas.base import CamelModel

Categoria = Literal["Facial", "Corporal"]


class ServicoRead(CamelModel):
    id: str
    categoria: str
    duracao_minutos: int
    exige_endereco: bool
    nome: str
    preco_centavos: int


class ServicoAdminRead(ServicoRead):
    """Visão do painel: inclui os serviços desativados."""

    ativo: bool


class ServicoCreate(CamelModel):
    categoria: Categoria
    duracao_minutos: int = Field(ge=10, le=480)
    exige_endereco: bool = False
    nome: str = Field(min_length=2, max_length=80)
    preco_centavos: int = Field(ge=0, le=10_000_00)


class ServicoUpdate(CamelModel):
    """Campos opcionais: só o que vier é alterado."""

    ativo: bool | None = None
    categoria: Categoria | None = None
    duracao_minutos: int | None = Field(default=None, ge=10, le=480)
    exige_endereco: bool | None = None
    nome: str | None = Field(default=None, min_length=2, max_length=80)
    preco_centavos: int | None = Field(default=None, ge=0, le=10_000_00)
