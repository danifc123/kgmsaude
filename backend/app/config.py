from enum import StrEnum
from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"


class ProvedorPagamento(StrEnum):
    """Como o sinal é cobrado."""

    FAKE = "fake"  # Pix simulado, para desenvolvimento sem credenciais
    MANUAL = "manual"  # chave Pix fixa + comprovante no WhatsApp, confirmado no painel
    MERCADO_PAGO = "mercado_pago"  # Pix dinâmico com confirmação automática


class Settings(BaseSettings):
    """Configurações da aplicação, lidas do ambiente ou do arquivo .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    admin_email: str = "admin@kgsaude.local"
    admin_password: str = "admin"
    antecedencia_minima_minutos: int = 120
    cors_origins: list[str] = ["http://127.0.0.1:8000"]
    database_url: str = "sqlite:///./kg.db"
    dias_maximos_agendamento: int = 30
    environment: str = "development"
    intervalo_grade_minutos: int = 30
    jwt_expira_minutos: int = 60 * 12
    jwt_secret: str = "dev-secret-troque-em-producao"
    mercado_pago_access_token: str = ""
    mercado_pago_webhook_secret: str = ""
    pagamento_expira_minutos: int = 30
    pagamento_provedor: ProvedorPagamento = ProvedorPagamento.FAKE
    sinal_percentual: int = 50
    timezone: str = "America/Fortaleza"
    url_publica: str = ""  # ex: https://kgsaude.onrender.com — usada no webhook

    @field_validator("database_url")
    @classmethod
    def _usar_driver_psycopg(cls, valor: str) -> str:
        """Neon/Render entregam postgres:// — o SQLAlchemy precisa do driver explícito."""
        for prefixo in ("postgres://", "postgresql://"):
            if valor.startswith(prefixo):
                return "postgresql+psycopg://" + valor.removeprefix(prefixo)
        return valor

    @property
    def cobra_pix_automatico(self) -> bool:
        return self.pagamento_provedor != ProvedorPagamento.MANUAL


@lru_cache
def get_settings() -> Settings:
    """Retorna a instância única de Settings."""
    return Settings()
