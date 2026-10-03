from app.schemas.base import CamelModel


class LoginRequest(CamelModel):
    email: str
    senha: str


class TokenRead(CamelModel):
    access_token: str
    token_type: str = "bearer"
