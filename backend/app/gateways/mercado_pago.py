import hashlib
import hmac
import logging
from collections.abc import Mapping
from zoneinfo import ZoneInfo

import httpx

from app.exceptions import GatewayError
from app.gateways.payment_gateway import CobrancaPix, NovaCobrancaPix, SituacaoPagamento
from app.models import StatusPagamento

logger = logging.getLogger(__name__)

API_URL = "https://api.mercadopago.com"

# Status do Mercado Pago → status interno. Qualquer outro conta como pendente.
STATUS_MERCADO_PAGO = {
    "approved": StatusPagamento.APROVADO,
    "cancelled": StatusPagamento.CANCELADO,
    "charged_back": StatusPagamento.CANCELADO,
    "refunded": StatusPagamento.CANCELADO,
    "rejected": StatusPagamento.CANCELADO,
}


class MercadoPagoGateway:
    """Pix dinâmico via API de pagamentos do Mercado Pago (POST/GET /v1/payments)."""

    nome = "mercado_pago"

    def __init__(
        self,
        access_token: str,
        webhook_secret: str,
        notification_url: str | None,
        timezone: str,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.client = httpx.Client(
            base_url=API_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=15,
            transport=transport,
        )
        self.notification_url = notification_url
        self.timezone = ZoneInfo(timezone)
        self.webhook_secret = webhook_secret

    def consultar_pagamento(self, provedor_pagamento_id: str) -> SituacaoPagamento:
        dados = self._requisitar("GET", f"/v1/payments/{provedor_pagamento_id}")
        return SituacaoPagamento(
            provedor_pagamento_id=str(dados["id"]),
            status=STATUS_MERCADO_PAGO.get(dados["status"], StatusPagamento.PENDENTE),
            valor_centavos=round(float(dados["transaction_amount"]) * 100),
        )

    def criar_cobranca_pix(self, cobranca: NovaCobrancaPix) -> CobrancaPix:
        """Cria o Pix; a chave de idempotência evita cobrança duplicada em retentativas."""
        expira_em = cobranca.expira_em.replace(tzinfo=self.timezone)
        corpo = {
            "date_of_expiration": expira_em.isoformat(timespec="milliseconds"),
            "description": cobranca.descricao,
            "external_reference": cobranca.agendamento_id,
            "payer": {"email": cobranca.pagador_email, "first_name": cobranca.pagador_nome},
            "payment_method_id": "pix",
            "transaction_amount": cobranca.valor_centavos / 100,
        }
        if self.notification_url:
            corpo["notification_url"] = self.notification_url

        dados = self._requisitar(
            "POST",
            "/v1/payments",
            json=corpo,
            headers={"X-Idempotency-Key": f"sinal-{cobranca.agendamento_id}"},
        )
        pix = dados["point_of_interaction"]["transaction_data"]
        return CobrancaPix(
            copia_cola=pix["qr_code"],
            provedor_pagamento_id=str(dados["id"]),
            qr_base64=pix.get("qr_code_base64"),
        )

    def validar_notificacao(self, headers: Mapping[str, str], query: Mapping[str, str]) -> bool:
        """
        Confere o x-signature: HMAC-SHA256, com a chave secreta do webhook, do manifesto
        "id:{data.id};request-id:{x-request-id};ts:{ts};". Sem chave configurada, aceita
        (o pagamento é sempre reconsultado na API antes de qualquer mudança).
        """
        if not self.webhook_secret:
            return True

        partes = dict(
            parte.strip().split("=", 1)
            for parte in headers.get("x-signature", "").split(",")
            if "=" in parte
        )
        ts, assinatura = partes.get("ts"), partes.get("v1")
        if not ts or not assinatura:
            return False

        manifesto = ""
        if data_id := query.get("data.id", "").lower():
            manifesto += f"id:{data_id};"
        if request_id := headers.get("x-request-id", ""):
            manifesto += f"request-id:{request_id};"
        manifesto += f"ts:{ts};"

        esperado = hmac.new(
            self.webhook_secret.encode(), manifesto.encode(), hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(esperado, assinatura)

    def _requisitar(self, metodo: str, caminho: str, **kwargs) -> dict:
        try:
            resposta = self.client.request(metodo, caminho, **kwargs)
        except httpx.HTTPError as exc:
            logger.exception("Mercado Pago indisponível")
            raise GatewayError("Não foi possível falar com o Mercado Pago agora.") from exc

        if resposta.is_error:
            logger.error(
                "Mercado Pago %s %s → %s: %s", metodo, caminho, resposta.status_code, resposta.text
            )
            raise GatewayError("O Mercado Pago recusou a cobrança. Tente novamente em instantes.")
        return resposta.json()
