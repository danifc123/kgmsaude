import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

import jwt
from sqlalchemy.orm import Session

from app.config import get_settings
from app.exceptions import NaoAutorizadoError
from app.repositories.usuario_repository import UsuarioRepository

ALGORITMO_JWT = "HS256"
ITERACOES_PBKDF2 = 600_000


def gerar_hash_senha(senha: str) -> str:
    """Hash PBKDF2-SHA256 no formato pbkdf2_sha256$iteracoes$salt$hash."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", senha.encode(), salt.encode(), ITERACOES_PBKDF2)
    return f"pbkdf2_sha256${ITERACOES_PBKDF2}${salt}${digest.hex()}"


def verificar_senha(senha: str, senha_hash: str) -> bool:
    """Compara a senha com o hash salvo em tempo constante."""
    _, iteracoes, salt, esperado = senha_hash.split("$")
    digest = hashlib.pbkdf2_hmac("sha256", senha.encode(), salt.encode(), int(iteracoes))
    return hmac.compare_digest(digest.hex(), esperado)


class AuthService:
    def __init__(self, db: Session) -> None:
        self.settings = get_settings()
        self.usuarios = UsuarioRepository(db)

    def decodificar_token(self, token: str) -> dict:
        """Valida assinatura e expiração. Retorna o payload do JWT."""
        try:
            return jwt.decode(token, self.settings.jwt_secret, algorithms=[ALGORITMO_JWT])
        except jwt.PyJWTError as exc:
            raise NaoAutorizadoError("Sessão expirada. Entre novamente.") from exc

    def login(self, email: str, senha: str) -> str:
        """Confere as credenciais e devolve um JWT de acesso."""
        usuario = self.usuarios.buscar_por_email(email.strip())
        if usuario is None or not verificar_senha(senha, usuario.senha_hash):
            raise NaoAutorizadoError("E-mail ou senha incorretos.")

        expira_em = datetime.now(UTC) + timedelta(minutes=self.settings.jwt_expira_minutos)
        payload = {"sub": usuario.email, "role": usuario.role, "exp": expira_em}
        return jwt.encode(payload, self.settings.jwt_secret, algorithm=ALGORITMO_JWT)
