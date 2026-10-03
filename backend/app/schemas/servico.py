from app.schemas.base import CamelModel


class ServicoRead(CamelModel):
    id: str
    categoria: str
    duracao_minutos: int
    exige_endereco: bool
    nome: str
    preco_centavos: int
