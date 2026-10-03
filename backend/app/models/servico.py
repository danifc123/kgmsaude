from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Servico(Base):
    __tablename__ = "servicos"

    id: Mapped[str] = mapped_column(String(60), primary_key=True)
    ativo: Mapped[bool] = mapped_column(default=True)
    categoria: Mapped[str] = mapped_column(String(30))
    duracao_minutos: Mapped[int]
    exige_endereco: Mapped[bool] = mapped_column(default=False)
    nome: Mapped[str] = mapped_column(String(80))
    preco_centavos: Mapped[int]
