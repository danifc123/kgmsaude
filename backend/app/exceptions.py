from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Erro de domínio com status HTTP associado."""

    status_code = 400

    def __init__(self, mensagem: str) -> None:
        super().__init__(mensagem)
        self.mensagem = mensagem


class ConflitoError(AppError):
    status_code = 409


class NaoAutorizadoError(AppError):
    status_code = 401


class NaoEncontradoError(AppError):
    status_code = 404


class RegraDeNegocioError(AppError):
    status_code = 422


def registrar_handlers(app: FastAPI) -> None:
    """Converte AppError em resposta JSON {"detail": mensagem}."""

    @app.exception_handler(AppError)
    async def _handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.mensagem})
