from collections.abc import Callable
from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from app.config import get_settings
from app.exceptions import NaoEncontradoError, RegraDeNegocioError
from app.models import Bloqueio, HorarioFuncionamento
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
            (a.inicio, a.fim)
            for a in self.agendamentos.listar_ocupando_entre(inicio_dia, fim_dia, self.agora())
        ]
        ocupados += [
            (b.inicio, b.fim) for b in self.agenda.listar_bloqueios_entre(inicio_dia, fim_dia)
        ]

        return gerar_horarios_livres(
            data=data,
            duracao=timedelta(minutes=duracao_minutos),
            expediente=expediente,
            ocupados=ocupados,
            primeiro_horario_permitido=self._primeiro_horario_permitido(),
            passo=timedelta(minutes=self.settings.intervalo_grade_minutos),
        )

    def horario_esta_livre(self, inicio: datetime, duracao_minutos: int) -> bool:
        """Se o horário aparece na grade de livres (expediente, antecedência e ocupação)."""
        return inicio in self.calcular_horarios_livres(inicio.date(), duracao_minutos)

    def intervalo_sem_conflito(self, agendamento_id: str, inicio: datetime, fim: datetime) -> bool:
        """
        Se [inicio, fim) não colide com outro agendamento nem com bloqueio. Usado ao
        confirmar um pagamento atrasado: o horário já foi validado na reserva, só
        importa se alguém ocupou depois.
        """
        outros = self.agendamentos.listar_ocupando_entre(inicio, fim, self.agora(), agendamento_id)
        return not outros and not self.agenda.listar_bloqueios_entre(inicio, fim)

    def _primeiro_horario_permitido(self) -> datetime:
        """
        Regra da Katiuschia: "marcar um dia antes" — nada no mesmo dia. O limite é o
        início do dia hoje + ANTECEDENCIA_MINIMA_DIAS, somado à folga em minutos.
        """
        agora = self.agora()
        primeiro_dia = agora.date() + timedelta(days=self.settings.antecedencia_minima_dias)
        return max(
            datetime.combine(primeiro_dia, time.min),
            agora + timedelta(minutes=self.settings.antecedencia_minima_minutos),
        )

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

    def listar_bloqueios(self, inicio: date | None, fim: date | None) -> list[Bloqueio]:
        """Bloqueios do período [inicio, fim] (datas inclusivas); sem período, os vigentes."""
        if inicio is None or fim is None:
            return self.agenda.listar_bloqueios_a_partir(self.agora())
        return self.agenda.listar_bloqueios_entre(
            datetime.combine(inicio, time.min), datetime.combine(fim + timedelta(days=1), time.min)
        )

    def atualizar_expediente(
        self, faixas: list[tuple[int, time, time]]
    ) -> list[HorarioFuncionamento]:
        """
        Substitui o horário de atendimento da semana. Vale para novos agendamentos;
        os já marcados continuam como estão.
        """
        self.agenda.substituir_expediente(
            [HorarioFuncionamento(dia_semana=d, abre_as=a, fecha_as=f) for d, a, f in faixas]
        )
        self.db.commit()
        return self.agenda.listar_expediente()

    def listar_expediente(self) -> list[HorarioFuncionamento]:
        return self.agenda.listar_expediente()

    def remover_bloqueio(self, bloqueio_id: int) -> None:
        bloqueio = self.agenda.buscar_bloqueio(bloqueio_id)
        if bloqueio is None:
            raise NaoEncontradoError("Bloqueio não encontrado.")
        self.db.delete(bloqueio)
        self.db.commit()

    # endregion
