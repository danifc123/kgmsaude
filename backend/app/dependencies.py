from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.clock import agora_local
from app.database import SessionLocal
from app.exceptions import NaoAutorizadoError
from app.services.agenda_service import AgendaService
from app.services.agendamento_service import AgendamentoService
from app.services.auth_service import AuthService
from app.services.catalogo_service import CatalogoService

_bearer = HTTPBearer(auto_error=False)


def get_db() -> Iterator[Session]:
    """Abre uma sessão de banco por requisição e garante o fechamento."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


DbSession = Annotated[Session, Depends(get_db)]


def get_agenda_service(db: DbSession) -> AgendaService:
    return AgendaService(db, agora_local)


def get_agendamento_service(db: DbSession) -> AgendamentoService:
    return AgendamentoService(db, agora_local)


def get_auth_service(db: DbSession) -> AuthService:
    return AuthService(db)


def get_catalogo_service(db: DbSession) -> CatalogoService:
    return CatalogoService(db)


def get_current_admin(
    credenciais: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    auth: Annotated[AuthService, Depends(get_auth_service)],
) -> str:
    """Exige um JWT válido com role admin. Retorna o e-mail do usuário."""
    if credenciais is None:
        raise NaoAutorizadoError("Faça login para continuar.")
    payload = auth.decodificar_token(credenciais.credentials)
    if payload.get("role") != "admin":
        raise NaoAutorizadoError("Acesso restrito.")
    return payload["sub"]
