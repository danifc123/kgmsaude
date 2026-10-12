import time
from collections import defaultdict, deque

from fastapi import Request

from app.exceptions import MuitasRequisicoesError


class LimitadorPorIp:
    """
    Janela deslizante em memória: no máximo `limite` chamadas por IP a cada
    `janela_segundos`. Suficiente para uma instância só (o caso deste projeto).
    """

    def __init__(self, limite: int, janela_segundos: int) -> None:
        self.chamadas: dict[str, deque[float]] = defaultdict(deque)
        self.janela = janela_segundos
        self.limite = limite

    def __call__(self, request: Request) -> None:
        ip = request.client.host if request.client else "desconhecido"
        agora = time.monotonic()
        chamadas = self.chamadas[ip]
        while chamadas and agora - chamadas[0] > self.janela:
            chamadas.popleft()
        if len(chamadas) >= self.limite:
            raise MuitasRequisicoesError("Muitas tentativas seguidas. Aguarde alguns minutos.")
        chamadas.append(agora)


# Conta também tentativas com erro de digitação, por isso a folga.
limitar_agendamentos = LimitadorPorIp(limite=10, janela_segundos=10 * 60)
