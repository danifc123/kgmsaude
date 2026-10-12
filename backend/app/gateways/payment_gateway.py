from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from app.models import StatusPagamento


@dataclass(frozen=True)
class NovaCobrancaPix:
    """O que o gateway precisa para gerar o Pix do sinal."""

    agendamento_id: str
    descricao: str
    expira_em: datetime  # horário local, sem tzinfo
    pagador_email: str
    pagador_nome: str
    valor_centavos: int


@dataclass(frozen=True)
class CobrancaPix:
    copia_cola: str
    provedor_pagamento_id: str
    qr_base64: str | None


@dataclass(frozen=True)
class SituacaoPagamento:
    """Estado do pagamento segundo o provedor — a fonte da verdade."""

    provedor_pagamento_id: str
    status: StatusPagamento
    valor_centavos: int


class PaymentGateway(Protocol):
    """Contrato de qualquer provedor de Pix (Mercado Pago, simulado, ...)."""

    nome: str

    def consultar_pagamento(self, provedor_pagamento_id: str) -> SituacaoPagamento: ...

    def criar_cobranca_pix(self, cobranca: NovaCobrancaPix) -> CobrancaPix: ...

    def validar_notificacao(self, headers: Mapping[str, str], query: Mapping[str, str]) -> bool: ...
