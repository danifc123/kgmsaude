from typing import Annotated

from fastapi import APIRouter, Depends

from app.dependencies import get_auth_service
from app.schemas.auth import LoginRequest, TokenRead
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenRead)
def login(dados: LoginRequest, auth: Annotated[AuthService, Depends(get_auth_service)]):
    """Troca e-mail e senha por um JWT de acesso ao painel."""
    return TokenRead(access_token=auth.login(dados.email, dados.senha))
