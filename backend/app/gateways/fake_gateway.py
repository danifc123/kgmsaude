import uuid
from collections.abc import Mapping

from app.exceptions import NaoEncontradoError
from app.gateways.payment_gateway import CobrancaPix, NovaCobrancaPix, SituacaoPagamento
from app.models import StatusPagamento


class FakeGateway:
    """
    Pix simulado para desenvolvimento: gera um copia e cola de mentira e guarda o
    status em memória. O pagamento é aprovado pela rota /api/dev/pagamentos/.../aprovar.
    """

    nome = "fake"
    _pagamentos: dict[str, SituacaoPagamento] = {}

    def aprovar(self, provedor_pagamento_id: str) -> None:
        atual = self.consultar_pagamento(provedor_pagamento_id)
        self._pagamentos[provedor_pagamento_id] = SituacaoPagamento(
            provedor_pagamento_id=provedor_pagamento_id,
            status=StatusPagamento.APROVADO,
            valor_centavos=atual.valor_centavos,
        )

    def consultar_pagamento(self, provedor_pagamento_id: str) -> SituacaoPagamento:
        situacao = self._pagamentos.get(provedor_pagamento_id)
        if situacao is None:
            raise NaoEncontradoError("Pagamento simulado não encontrado (o servidor reiniciou?).")
        return situacao

    def criar_cobranca_pix(self, cobranca: NovaCobrancaPix) -> CobrancaPix:
        provedor_pagamento_id = f"fake-{uuid.uuid4().hex[:12]}"
        self._pagamentos[provedor_pagamento_id] = SituacaoPagamento(
            provedor_pagamento_id=provedor_pagamento_id,
            status=StatusPagamento.PENDENTE,
            valor_centavos=cobranca.valor_centavos,
        )
        return CobrancaPix(
            copia_cola=f"00020126PIXSIMULADO{provedor_pagamento_id}5204000053039865802BR6304FAKE",
            provedor_pagamento_id=provedor_pagamento_id,
            qr_base64=None,
        )

    def validar_notificacao(self, headers: Mapping[str, str], query: Mapping[str, str]) -> bool:
        return True
