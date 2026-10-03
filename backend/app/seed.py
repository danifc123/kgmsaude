"""Dados iniciais. Roda na subida da API e só insere o que ainda não existe."""

from datetime import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import HorarioFuncionamento, Servico, Usuario
from app.services.auth_service import gerar_hash_senha

# (id, nome, categoria, duração em min, preço em centavos, exige endereço)
# Limpeza de pele e massagem terapêutica: 60 min provisórios — confirmar com a Katiuschia.
SERVICOS = [
    ("revitalizacao-labial", "Revitalização labial", "Facial", 15, 5000, False),
    ("revitalizacao-facial", "Revitalização facial", "Facial", 60, 7000, False),
    ("limpeza-pele", "Limpeza de pele", "Facial", 60, 15000, False),
    ("ventosa-terapia", "Ventosa terapia", "Corporal", 30, 8000, False),
    ("esfoliacao-corporal", "Esfoliação corporal", "Corporal", 30, 10000, False),
    ("detox-termal", "Detox termal", "Corporal", 30, 12000, False),
    ("massagem-relaxante", "Massagem relaxante", "Corporal", 45, 12000, False),
    ("massagem-terapeutica", "Massagem terapêutica", "Corporal", 60, 13000, False),
    ("massagem-domicilio", "Massagem a domicílio", "Corporal", 60, 18000, True),
]

# Provisório: segunda a sexta 9h–18h, sábado 9h–13h. 0 = segunda.
EXPEDIENTE = [(dia, time(9), time(18)) for dia in range(5)] + [(5, time(9), time(13))]


def popular_banco(db: Session) -> None:
    """Insere serviços, expediente e o usuário admin quando ainda não existem."""
    if db.scalar(select(Servico.id).limit(1)) is None:
        db.add_all(
            Servico(
                id=id_,
                nome=nome,
                categoria=categoria,
                duracao_minutos=duracao,
                preco_centavos=preco,
                exige_endereco=exige_endereco,
            )
            for id_, nome, categoria, duracao, preco, exige_endereco in SERVICOS
        )

    if db.scalar(select(HorarioFuncionamento.id).limit(1)) is None:
        db.add_all(
            HorarioFuncionamento(dia_semana=dia, abre_as=abre, fecha_as=fecha)
            for dia, abre, fecha in EXPEDIENTE
        )

    settings = get_settings()
    email = settings.admin_email.lower()
    if db.scalar(select(Usuario.id).where(Usuario.email == email)) is None:
        db.add(Usuario(email=email, senha_hash=gerar_hash_senha(settings.admin_password)))

    db.commit()
