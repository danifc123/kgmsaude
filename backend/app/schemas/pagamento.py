from datetime import datetime

from app.config import ProvedorPagamento
from app.models import StatusPagamento
from app.schemas.base import CamelModel


class PagamentoConfigRead(CamelModel):
    """Diz ao front se o sinal é cobrado com Pix automático ou com a chave manual."""

    pix_automatico: bool
    provedor: ProvedorPagamento
    sinal_percentual: int


class PagamentoRead(CamelModel):
    expira_em: datetime
    pago_em: datetime | None
    pix_copia_cola: str
    pix_qr_base64: str | None
    provedor: str
    status: StatusPagamento
    valor_centavos: int
