from functools import lru_cache

from app.config import ProvedorPagamento, get_settings
from app.gateways.fake_gateway import FakeGateway
from app.gateways.mercado_pago import MercadoPagoGateway
from app.gateways.payment_gateway import (
    CobrancaPix,
    NovaCobrancaPix,
    PaymentGateway,
    SituacaoPagamento,
)

__all__ = [
    "CobrancaPix",
    "FakeGateway",
    "MercadoPagoGateway",
    "NovaCobrancaPix",
    "PaymentGateway",
    "SituacaoPagamento",
    "criar_gateway",
]


@lru_cache
def criar_gateway() -> PaymentGateway | None:
    """Gateway configurado em PAGAMENTO_PROVEDOR. None no modo manual."""
    settings = get_settings()
    match settings.pagamento_provedor:
        case ProvedorPagamento.FAKE:
            return FakeGateway()
        case ProvedorPagamento.MERCADO_PAGO:
            url_publica = settings.url_publica.rstrip("/")
            return MercadoPagoGateway(
                access_token=settings.mercado_pago_access_token,
                notification_url=(
                    f"{url_publica}/api/pagamentos/webhook"
                    if url_publica.startswith("https://")
                    else None
                ),
                timezone=settings.timezone,
                webhook_secret=settings.mercado_pago_webhook_secret,
            )
    return None
