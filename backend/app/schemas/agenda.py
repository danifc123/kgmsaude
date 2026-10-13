from datetime import date, datetime

from pydantic import Field, model_validator

from app.schemas.base import CamelModel


class AgendaConfigRead(CamelModel):
    """Janela de datas que a cliente pode escolher."""

    antecedencia_minima_dias: int
    dias_maximos_agendamento: int


class BloqueioCreate(CamelModel):
    fim: datetime
    inicio: datetime
    motivo: str | None = Field(default=None, max_length=120)

    @model_validator(mode="after")
    def _validar_periodo(self) -> "BloqueioCreate":
        if self.fim <= self.inicio:
            raise ValueError("O fim do bloqueio precisa ser depois do início.")
        return self


class BloqueioRead(CamelModel):
    id: int
    fim: datetime
    inicio: datetime
    motivo: str | None


class HorariosLivresRead(CamelModel):
    data: date
    duracao_minutos: int
    horarios: list[str]
