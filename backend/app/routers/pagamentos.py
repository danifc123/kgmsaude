import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status

from app.config import ProvedorPagamento, get_settings
from app.dependencies import get_pagamento_service
from app.exceptions import AppError, NaoAutorizadoError
from app.schemas.pagamento import PagamentoConfigRead
from app.services.pagamento_service import PagamentoService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pagamentos", tags=["pagamentos"])
dev_router = APIRouter(prefix="/dev", tags=["dev"])

PagamentoDep = Annotated[PagamentoService, Depends(get_pagamento_service)]


@router.get("/config", response_model=PagamentoConfigRead)
def obter_config_pagamento():
    """Como o sinal é cobrado: Pix automático (com QR code) ou chave manual."""
    settings = get_settings()
    return PagamentoConfigRead(
        pix_automatico=settings.cobra_pix_automatico,
        provedor=settings.pagamento_provedor,
        sinal_percentual=settings.sinal_percentual,
    )


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def receber_webhook(request: Request, pagamentos: PagamentoDep) -> Response:
    """
    Aviso do Mercado Pago (?type=payment&data.id=...). Valida a assinatura e reconsulta
    o pagamento na API. Responde 200 mesmo para avisos ignorados, para não haver
    retentativas; só assinatura inválida devolve 401.
    """
    query = dict(request.query_params)
    if not pagamentos.gateway.validar_notificacao(request.headers, query):
        raise NaoAutorizadoError("Assinatura inválida.")

    corpo = await request.json() if await request.body() else {}
    tipo = query.get("type") or query.get("topic") or corpo.get("type")
    pagamento_id = query.get("data.id") or query.get("id") or corpo.get("data", {}).get("id")
    if tipo != "payment" or not pagamento_id:
        return Response(status_code=status.HTTP_200_OK)

    try:
        pagamentos.processar_notificacao(str(pagamento_id))
    except AppError:
        # O Mercado Pago reenvia em caso de erro; o polling do checkout também cobre.
        logger.exception("Falha ao processar webhook do pagamento %s", pagamento_id)
        return Response(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return Response(status_code=status.HTTP_200_OK)


@dev_router.post("/pagamentos/{agendamento_id}/aprovar", status_code=status.HTTP_204_NO_CONTENT)
def aprovar_pagamento_simulado(agendamento_id: str, pagamentos: PagamentoDep) -> None:
    """Só com PAGAMENTO_PROVEDOR=fake: simula a cliente pagando o Pix."""
    pagamentos.aprovar_simulado(agendamento_id)


def incluir_rota_dev() -> bool:
    return get_settings().pagamento_provedor == ProvedorPagamento.FAKE
