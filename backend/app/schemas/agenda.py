from datetime import date, datetime, time

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


class ExpedienteRead(CamelModel):
    """Uma faixa de atendimento. dia_semana: 0 = segunda ... 6 = domingo."""

    abre_as: time
    dia_semana: int = Field(ge=0, le=6)
    fecha_as: time


class ExpedienteUpdate(CamelModel):
    """Horário completo da semana. Dia sem faixa = fechado."""

    faixas: list[ExpedienteRead] = Field(max_length=28)

    @model_validator(mode="after")
    def _validar_faixas(self) -> "ExpedienteUpdate":
        nomes = [
            "Na segunda",
            "Na terça",
            "Na quarta",
            "Na quinta",
            "Na sexta",
            "No sábado",
            "No domingo",
        ]
        for dia in range(7):
            faixas = sorted(
                (f for f in self.faixas if f.dia_semana == dia), key=lambda f: f.abre_as
            )
            for faixa in faixas:
                if faixa.fecha_as <= faixa.abre_as:
                    raise ValueError(f"{nomes[dia]}, o fim precisa ser depois do início.")
            for anterior, atual in zip(faixas, faixas[1:], strict=False):
                if atual.abre_as < anterior.fecha_as:
                    raise ValueError(f"{nomes[dia]}, dois horários estão se sobrepondo.")
        return self


class HorariosLivresRead(CamelModel):
    data: date
    duracao_minutos: int
    horarios: list[str]
