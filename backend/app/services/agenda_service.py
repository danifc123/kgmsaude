from collections.abc import Callable
from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from app.config import get_settings
from app.exceptions import NaoEncontradoError, RegraDeNegocioError
from app.models import Bloqueio
from app.repositories.agenda_repository import AgendaRepository
from app.repositories.agendamento_repository import AgendamentoRepository

Intervalo = tuple[datetime, datetime]


def gerar_horarios_livres(
    data: date,
    duracao: timedelta,
    expediente: list[tuple[time, time]],
    ocupados: list[Intervalo],
    primeiro_horario_permitido: datetime,
    passo: timedelta,
) -> list[datetime]:
    """
    Percorre cada faixa do expediente de `passo` em `passo` e devolve os inícios em que
    o atendimento inteiro cabe na faixa, não colide com nada ocupado e respeita a
    antecedência mínima.
    """
    livres: list[datetime] = []
    for abre_as, fecha_as in expediente:
        inicio = datetime.combine(data, abre_as)
        limite = datetime.combine(data, fecha_as)
        while inicio + duracao <= limite:
            fim = inicio + duracao
            colide = any(o_inicio < fim and inicio < o_fim for o_inicio, o_fim in ocupados)
            if inicio >= primeiro_horario_permitido and not colide:
                livres.append(inicio)
            inicio += passo
    return livres


class AgendaService:
    def __init__(self, db: Session, agora: Callable[[], datetime]) -> None:
        self.agenda = AgendaRepository(db)
        self.agendamentos = AgendamentoRepository(db)
        self.agora = agora
        self.db = db
        self.settings = get_settings()

    # region Horários livres

    def calcular_horarios_livres(self, data: date, duracao_minutos: int) -> list[datetime]:
        """Horários de início disponíveis no dia para um atendimento da duração informada."""
        self._validar_data(data)
        inicio_dia = datetime.combine(data, time.min)
        fim_dia = inicio_dia + timedelta(days=1)

        expediente = [
            (h.abre_as, h.fecha_as) for h in self.agenda.listar_horarios_do_dia(data.weekday())
        ]
        ocupados = [
            (a.inicio, a.fim) for a in self.agendamentos.listar_ocupando_entre(inicio_dia, fim_dia)
        ]
        ocupados += [
            (b.inicio, b.fim) for b in self.agenda.listar_bloqueios_entre(inicio_dia, fim_dia)
        ]
        antecedencia = timedelta(minutes=self.settings.antecedencia_minima_minutos)

        return gerar_horarios_livres(
            data=data,
            duracao=timedelta(minutes=duracao_minutos),
            expediente=expediente,
            ocupados=ocupados,
            primeiro_horario_permitido=self.agora() + antecedencia,
            passo=timedelta(minutes=self.settings.intervalo_grade_minutos),
        )

    def horario_esta_livre(self, inicio: datetime, duracao_minutos: int) -> bool:
        return inicio in self.calcular_horarios_livres(inicio.date(), duracao_minutos)

    def _validar_data(self, data: date) -> None:
        dias = self.settings.dias_maximos_agendamento
        hoje = self.agora().date()
        if not hoje <= data <= hoje + timedelta(days=dias):
            raise RegraDeNegocioError(f"Escolha uma data entre hoje e os próximos {dias} dias.")

    # endregion

    # region Bloqueios

    def criar_bloqueio(self, inicio: datetime, fim: datetime, motivo: str | None) -> Bloqueio:
        bloqueio = Bloqueio(inicio=inicio, fim=fim, motivo=(motivo or "").strip() or None)
        self.db.add(bloqueio)
        self.db.commit()
        return bloqueio

    def listar_bloqueios_futuros(self) -> list[Bloqueio]:
        return self.agenda.listar_bloqueios_a_partir(self.agora())

    def remover_bloqueio(self, bloqueio_id: int) -> None:
        bloqueio = self.agenda.buscar_bloqueio(bloqueio_id)
        if bloqueio is None:
            raise NaoEncontradoError("Bloqueio não encontrado.")
        self.db.delete(bloqueio)
        self.db.commit()

    # endregion
